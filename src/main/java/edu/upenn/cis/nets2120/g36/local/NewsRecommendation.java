package edu.upenn.cis.nets2120.g36.local;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.sql.SparkSession;

import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.ItemCollection;
import com.amazonaws.services.dynamodbv2.document.ScanOutcome;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.spec.ScanSpec;

import edu.upenn.cis.nets2120.config.Config;
import edu.upenn.cis.nets2120.g36.loader.DynamoConnector;
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
	JavaRDD<Tuple2<String, String>> todaysArticles; // Schema: (id, type)
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
	
	void loadDataDynamo() {
		DynamoDB db = DynamoConnector.getConnection(Config.DYNAMODB_URL);
		
		// Reads categories table and from it gets nodes: categories, articles, shadow nodes, edges: topics (article, category), shadow edges (shadow, article)
		Table newsTable = db.getTable("news");
		ItemCollection<ScanOutcome> news = newsTable.scan(new ScanSpec());
		ArrayList<Tuple2<String, String>> catList = new ArrayList<>();
		ArrayList<Tuple2<String, String>> artList = new ArrayList<>();
		ArrayList<Tuple2<String, String>> todaysArtList = new ArrayList<>();
		ArrayList<Tuple2<Tuple2<String, String>, Tuple2<String, String>>> shadowEdgesList = new ArrayList<>();
		ArrayList<Tuple2<Tuple2<String, String>, Tuple2<String, String>>> topicList = new ArrayList<>();
		int i = 0;
		for (Item row : news) {
			// add to category only if distinct
			if (!catList.contains(new Tuple2<>(row.getString("category"), "CATEGORY"))) {
				catList.add(new Tuple2<>(row.getString("category"), "CATEGORY"));
			}
			// add article and shadow version
			artList.add(new Tuple2<>(row.getString("article_id"), "ARTICLE"));
			artList.add(new Tuple2<>(row.getString("article_id"), "SHADOW"));
			// add article to todays article list only if date matches
			if (row.getString("date").equals("2022-11-30")) {
				System.out.println(i + ": " + row.getString("article_id") + " " + row.getString("date") + " " + row.getString("headline"));
				i++;
				todaysArtList.add(new Tuple2<>(row.getString("article_id"), "ARTICLE"));
			}
			// add shadow edge from shadow node to article
			shadowEdgesList.add(new Tuple2<>(new Tuple2<>(row.getString("article_id"), "SHADOW"), new Tuple2<>(row.getString("article_id"), "ARTICLE")));
			// add both directions of topic
			topicList.add(new Tuple2<>(new Tuple2<>(row.getString("category"), "CATEGORY"), new Tuple2<>(row.getString("article_id"), "ARTICLE")));
			topicList.add(new Tuple2<>(new Tuple2<>(row.getString("article_id"), "ARTICLE"), new Tuple2<>(row.getString("category"), "CATEGORY")));
		}
		JavaRDD<Tuple2<String, String>> catNodes = context.parallelize(catList);
		JavaRDD<Tuple2<String, String>> artNodes = context.parallelize(artList);
		JavaPairRDD<Tuple2<String, String>, Tuple2<String, String>> shadowEdges = context.parallelizePairs(shadowEdgesList);
		JavaPairRDD<Tuple2<String, String>, Tuple2<String, String>> topicEdges = context.parallelizePairs(topicList);
		todaysArticles = context.parallelize(todaysArtList);
		
		
		// Reads friend table and from it gets edges: friends (user, user)
		Table friendTable = db.getTable("friend");
		ItemCollection<ScanOutcome> friends = friendTable.scan(new ScanSpec());
		ArrayList<Tuple2<Tuple2<String, String>, Tuple2<String, String>>> friendList = new ArrayList<>();
		for (Item row : friends) {
			// friend table symmetric so do not need to add both directions (already in table)
			friendList.add(new Tuple2<>(new Tuple2<>(row.getString("login"), "USER"), new Tuple2<>(row.getString("friend_login"), "USER")));
		}
		JavaPairRDD<Tuple2<String, String>, Tuple2<String, String>> friendEdges = context.parallelizePairs(friendList);
		
		// Reads user table and from it gets nodes: users, edges: subscriptions (user, category)
		Table userTable = db.getTable("user");
		ItemCollection<ScanOutcome> users = userTable.scan(new ScanSpec());
		ArrayList<Tuple2<String, String>> userList = new ArrayList<>();
		ArrayList<Tuple2<Tuple2<String, String>, Tuple2<String, String>>> subList = new ArrayList<>();
		for (Item row : users) {
			// add user
			userList.add(new Tuple2<>(row.getString("login"), "USER"));
			// add all of users interest (both directions)
			for (Object sub : row.getList("interests")) {
				subList.add(new Tuple2<>(new Tuple2<>(row.getString("login"), "USER"), new Tuple2<>((String) sub, "CATEGORY")));
				subList.add(new Tuple2<>(new Tuple2<>(((String) sub).toUpperCase(), "CATEGORY"), new Tuple2<>(row.getString("login"), "USER")));
			}
		}
		JavaRDD<Tuple2<String, String>> userNodes = context.parallelize(userList);
		JavaPairRDD<Tuple2<String, String>, Tuple2<String, String>> subEdges = context.parallelizePairs(subList);
		
		// Reads user table and from it gets edges: likes (user, article)
		Table likesTable = db.getTable("likes");
		ItemCollection<ScanOutcome> likes = likesTable.scan(new ScanSpec());
		ArrayList<Tuple2<Tuple2<String, String>, Tuple2<String, String>>> likesList = new ArrayList<>();
		for (Item row : likes) {
			// add both directions of like
			likesList.add(new Tuple2<>(new Tuple2<>(row.getString("login"), "USER"), new Tuple2<>(row.getString("article_id"), "ARTICLE")));
		}
		JavaPairRDD<Tuple2<String, String>, Tuple2<String, String>> likeEdges = context.parallelizePairs(likesList);
		
		nodes = userNodes.union(catNodes).union(artNodes);
		edges = friendEdges.union(subEdges).union(topicEdges).union(likeEdges).union(shadowEdges);
		
		db.shutdown();
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
				
//		nodes.foreach(t -> System.out.println("NODE: " + t));
//		edges.foreach(t -> System.out.println("EDGE: " + t));
			
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
			
//			System.out.println("ITERATION: " + i);
//			System.out.println("SIZE: " + labels.count());
		}
		
		JavaPairRDD<Tuple2<String, String>, Tuple2<String, Double>> todayLabels = labels
			.join(todaysArticles.mapToPair(t -> new Tuple2<>(t, "")))
			.mapToPair(t -> new Tuple2<>(t._1, t._2._1));
		System.out.println("SIZE: " + todayLabels.count());
		todayLabels.foreach(t -> System.out.println(t));
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
			
//			nr.loadDataLocal(Config.LOCAL_NEWS_DATA_PATH);
			nr.loadDataDynamo();

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
