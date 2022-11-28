package edu.upenn.cis.nets2120.g36;

import java.io.IOException;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.sql.SparkSession;

import edu.upenn.cis.nets2120.config.Config;
import edu.upenn.cis.nets2120.storage.SparkConnector;
import scala.Tuple2;

public class NewsRecommendation {
	/**
	 * The basic logger
	 */
	static Logger logger = LogManager.getLogger(NewsRecommendation.class);

	/**
	 * Connection to Apache Spark
	 */
	SparkSession spark;
	
	JavaSparkContext context;
	
	JavaRDD<Tuple2<String, String>> nodes; // Schema: (id, type)
	JavaPairRDD<Tuple2<String, String>, Tuple2<String, String>> edges; // Schema: (src: (id, type), dest: (id, type))

	public NewsRecommendation() {
		System.setProperty("file.encoding", "UTF-8");
	}

	/**
	 * Initialize the database connection and open the file
	 * 
	 * @throws IOException
	 * @throws InterruptedException 
	 */
	public void initialize() throws IOException, InterruptedException {
		logger.info("Connecting to Spark...");

		spark = SparkConnector.getSparkConnection();
		context = SparkConnector.getSparkContext();
		
		logger.debug("Connected!");
	}

	void loadDataLocal(String filePath) {
		JavaRDD<String> inputFile = context.textFile(filePath);
		nodes = inputFile
			.filter(s -> s.split(" ").length == 2)
			.map(s -> {
				String[] split = s.split(" ");
				return new Tuple2<String, String>(split[1], split[0]);
			});
		nodes = nodes.union(nodes
				.filter(t -> t._2.equals("ARTICLE"))
				.map(t -> new Tuple2<>(t._1, "SHADOW"))
		);

		edges = inputFile
			.filter(s -> s.split(" ").length == 3)
			.mapToPair(s -> {
				String[] split = s.split(" ");
				if (split[0].equals("LIKE")) return new Tuple2<>(new Tuple2<>(split[1], "USER"), new Tuple2<>(split[2], "ARTICLE"));
				else if (split[0].equals("FRIEND")) return new Tuple2<>(new Tuple2<>(split[1], "USER"), new Tuple2<>(split[2], "USER"));
				else if (split[0].equals("TOPIC")) return new Tuple2<>(new Tuple2<>(split[1], "ARTICLE"), new Tuple2<>(split[2], "CATEGORY"));
				else if (split[0].equals("SUBSCRIBE")) return new Tuple2<>(new Tuple2<>(split[1], "USER"), new Tuple2<>(split[2], "CATEGORY"));
				else return new Tuple2<>(new Tuple2<>(split[0], ""), new Tuple2<>(split[1], ""));
			});
		edges = edges
			.union(edges.mapToPair(t -> new Tuple2<>(t._2, t._1))) // all edges should have back edges
			.union(nodes
				.filter(t -> t._2.equals("ARTICLE"))
				.mapToPair(t -> new Tuple2<>(new Tuple2<>(t._1, "SHADOW"), new Tuple2<>(t._1, "ARTICLE")))
			);
	}
	
	public JavaPairRDD<Tuple2<String, String>, Tuple2<Tuple2<String, String>, Double>> computeEdgeTransferRDD() {
		JavaPairRDD<Tuple2<Tuple2<String, String>, String>, Double> nodeTransferRDD = edges
				.mapToPair(t -> {
					Double wt = 1.0;
					Tuple2<String, String> src = t._1;
					Tuple2<String, String> dest = t._2;
					String destLabel = dest._2;
					if (src._2.equals("USER")) {
						if ((dest._2).equals("USER")) wt = 1 / 0.3;
						else if ((dest._2).equals("ARTICLE")) wt = 1 / 0.4;
						else if ((dest._2).equals("CATEGORY")) wt = 1 / 0.3;
					} else if (src._2.equals("ARTICLE")) {
						destLabel = "CATEGORY";
					} else if (src._2.equals("CATEGORY")) {
						destLabel = "ARTICLE";
					}
					
					return new Tuple2<>(new Tuple2<>(src, destLabel), wt);
				})
				.reduceByKey((a, b) -> a + b)
				.mapToPair(t -> new Tuple2<>(t._1, 1.0 / t._2));
			
			nodeTransferRDD = nodeTransferRDD
				.filter(t -> t._1._1._2.equals("ARTICLE") || t._1._1._2.equals("CATEGORY"))
				.mapToPair(t -> new Tuple2<>(new Tuple2<>(t._1._1, "USER"), t._2))
				.union(nodeTransferRDD);
			
			JavaPairRDD<Tuple2<String, String>, Tuple2<Tuple2<String, String>, Double>> edgeTransferRDD = edges
				.mapToPair(t -> new Tuple2<>(new Tuple2<>(t._1, t._2._2), t._2))
				.join(nodeTransferRDD)
				.mapToPair(t -> new Tuple2<>(t._1._1, t._2));
			
			return edgeTransferRDD;
	}

	public void run() throws IOException, InterruptedException {
		logger.info("Running");
		
		loadDataLocal(Config.LOCAL_NEWS_DATA_PATH);
		
	//		nodes.foreach(t -> System.out.println("NODE: " + t));
	//		edges.foreach(t -> System.out.println("EDGE: " + t));
	//		
			
		JavaPairRDD<Tuple2<String, String>, Tuple2<Tuple2<String, String>, Double>> edgeTransferRDD = computeEdgeTransferRDD();
		
		JavaPairRDD<Tuple2<String, String>, Tuple2<String, Double>> shadowLabels = nodes
				.filter(t -> t._2.equals("SHADOW"))
				.mapToPair(t -> new Tuple2<>(t, new Tuple2<>(t._1, 1.0)));

		JavaPairRDD<Tuple2<String, String>, Tuple2<String, Double>> labels = JavaPairRDD.fromJavaRDD(context.emptyRDD());
		
		for (int i = 1; i <= 15; i++) {
			labels = labels.union(shadowLabels);
			
			JavaPairRDD<Tuple2<Tuple2<String, String>, String>, Double> propogateRDD = labels
				.join(edgeTransferRDD) // Schema: (src: (id, type), (label: (id, weight), (dest: (id, type), multiplier)
				.mapToPair(t -> new Tuple2<>(new Tuple2<>(t._2._2._1, t._2._1._1), t._2._1._2 * t._2._2._2));
			JavaPairRDD<Tuple2<String, String>, Tuple2<String, Double>> rawNewLabels = propogateRDD
				.reduceByKey((a, b) -> a + b) // add up propagated weights from all sources
				.mapToPair(t -> new Tuple2<>(t._1._1, new Tuple2<>(t._1._2 , t._2)));
			JavaPairRDD<Tuple2<String, String>, Double> labelWeightTotals= rawNewLabels
				.mapToPair(t -> new Tuple2<>(t._1, t._2._2))
				.reduceByKey((a, b) -> a + b);
			JavaPairRDD<Tuple2<String, String>, Tuple2<String, Double>> newLabels = rawNewLabels
				.join(labelWeightTotals)
				.mapToPair(t -> new Tuple2<>(t._1, new Tuple2<>(t._2._1._1, t._2._1._2 / t._2._2)));
			
			labels = newLabels;
			
			System.out.println("ITERATION: " + i);
			labels.foreach(t -> {
				System.out.println(t);
			});		
		}
	}


	/**
	 * Graceful shutdown
	 */
	public void shutdown() {
		logger.info("Shutting down");

		if (spark != null) spark.close();
	}

	public static void main(String[] args) {
		final NewsRecommendation nr = new NewsRecommendation();
		
		try {
			nr.initialize();

			nr.run();
		} catch (final IOException ie) {
			logger.error("I/O error: ");
			ie.printStackTrace();
		} catch (final InterruptedException e) {
			e.printStackTrace();
		} finally {
			nr.shutdown();
		}
	}

}
