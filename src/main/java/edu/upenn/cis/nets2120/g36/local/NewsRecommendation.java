package edu.upenn.cis.nets2120.g36.local;

import java.io.IOException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.sql.SparkSession;

import com.amazonaws.services.dynamodbv2.document.BatchWriteItemOutcome;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.ItemCollection;
import com.amazonaws.services.dynamodbv2.document.ScanOutcome;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.document.spec.ScanSpec;
import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.ProvisionedThroughput;
import com.amazonaws.services.dynamodbv2.model.ResourceInUseException;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;

import edu.upenn.cis.nets2120.config.Config;
import edu.upenn.cis.nets2120.g36.loader.DynamoConnector;
import edu.upenn.cis.nets2120.storage.SparkConnector;
import scala.Tuple2;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;

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

	/**
	 * Connection to DynamoDB
	 */
	DynamoDB db;
	final String newsTableName = "news_weights";

	/**
	 * Graph information
	 */
	JavaRDD<Tuple2<String, String>> nodes; // Schema: (id, type)
	JavaPairRDD<Tuple2<String, String>, Tuple2<String, String>> edges; // Schema: (src: (id, type), dest: (id, type))
	HashMap<String, String> artDates; // dates of articles

	public NewsRecommendation() {
		System.setProperty("file.encoding", "UTF-8");
	}

	/**
	 * Initialize the spark
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

	/**
	 * Loads graph data from local file
	 * 
	 * @param filePath path to local data file
	 */
	void loadDataLocal(String filePath) {
		JavaRDD<String> inputFile = context.textFile(filePath);
		// read all nodes from in and parse them
		nodes = inputFile
			.filter(s -> s.split(" ").length == 2)
			.map(s -> {
				String[] split = s.split(" ");
				return new Tuple2<String, String>(split[1], split[0]);
			});
		
		// add shadow nodes for articles
		nodes = nodes.union(nodes
				.filter(t -> t._2.equals("ARTICLE"))
				.map(t -> new Tuple2<>(t._1, "SHADOW"))
		);

		// read all edges and parse them
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
		
		// add edges for shadow article nodes
		edges = edges
			.union(edges.mapToPair(t -> new Tuple2<>(t._2, t._1))) // all edges should have back edges
			.union(nodes
				.filter(t -> t._2.equals("ARTICLE"))
				.mapToPair(t -> new Tuple2<>(new Tuple2<>(t._1, "SHADOW"), new Tuple2<>(t._1, "ARTICLE")))
			);
	}
	
	/**
	 * Loads graph data from DynamoDB
	 */
	void loadDataDynamo() {
		db = DynamoConnector.getConnection(Config.DYNAMODB_URL);
		artDates = new HashMap<>();
				
		// Reads categories table and from it gets nodes: categories, articles, shadow nodes, edges: topics (article, category), shadow edges (shadow, article)
		Table newsTable = db.getTable("news");
		ItemCollection<ScanOutcome> news = newsTable.scan(new ScanSpec());
		ArrayList<Tuple2<String, String>> catList = new ArrayList<>();
		ArrayList<Tuple2<String, String>> artList = new ArrayList<>();
		ArrayList<Tuple2<Tuple2<String, String>, Tuple2<String, String>>> shadowEdgesList = new ArrayList<>();
		ArrayList<Tuple2<Tuple2<String, String>, Tuple2<String, String>>> topicList = new ArrayList<>();
		for (Item row : news) {
			LocalDate today = LocalDate.now();
			LocalDate rowDate = LocalDate.parse(row.getString("date"));
			String id = row.getString("article_id");

			if (rowDate.isBefore(today.minusDays(14)) || rowDate.isAfter(today)) {
				continue;
			}
			
			// add to category only if distinct
			if (!catList.contains(new Tuple2<>(row.getString("category"), "CATEGORY"))) {
				catList.add(new Tuple2<>(row.getString("category"), "CATEGORY"));
			}
			// add article and shadow version
			artList.add(new Tuple2<>(id, "ARTICLE"));
			artList.add(new Tuple2<>(id, "SHADOW"));
	
			// add date of article to hashmap
			artDates.put(id, row.getString("date"));
			
			// add shadow edge from shadow node to article
			shadowEdgesList.add(new Tuple2<>(new Tuple2<>(id, "SHADOW"), new Tuple2<>(id, "ARTICLE")));
			// add both directions of topic
			topicList.add(new Tuple2<>(new Tuple2<>(row.getString("category"), "CATEGORY"), new Tuple2<>(id, "ARTICLE")));
			topicList.add(new Tuple2<>(new Tuple2<>(id, "ARTICLE"), new Tuple2<>(row.getString("category"), "CATEGORY")));
		}
		JavaRDD<Tuple2<String, String>> catNodes = context.parallelize(catList);
		JavaRDD<Tuple2<String, String>> artNodes = context.parallelize(artList);
		JavaPairRDD<Tuple2<String, String>, Tuple2<String, String>> shadowEdges = context.parallelizePairs(shadowEdgesList);
		JavaPairRDD<Tuple2<String, String>, Tuple2<String, String>> topicEdges = context.parallelizePairs(topicList);
		
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
	}
	
	/**
	 * Batch write up to 25 items
	 * 
	 * @throws DynamoDbException DynamoDB is unhappy with something
	 * @throws InterruptedException User presses Ctrl-C
	 */
	private void batchWriteItems(List<Item> items, DynamoDB db, String tableName) throws DynamoDbException, InterruptedException {
		// Quit early if items empty or too many
		if (items.isEmpty() || items.size() > 25)
			return;
		
		// Batch write up to 25 items
		TableWriteItems batch = new TableWriteItems(tableName);
		batch.withItemsToPut(items);
		BatchWriteItemOutcome outcome = db.batchWriteItem(batch);
		
		// Process remaining items if there was issue
		if (outcome.getUnprocessedItems().size() > 0) {
			db.batchWriteItemUnprocessed(outcome.getUnprocessedItems());
		}
	}
	
	/**
	 * Uploads label weights to DynamoDB at the end of algorithm
	 * 
	 * @throws DynamoDbException DynamoDB is unhappy with something
	 * @throws InterruptedException User presses Ctrl-C
	 */
	void uploadLabels(JavaPairRDD<Tuple2<String, String>, Tuple2<String, Double>> labels) throws DynamoDbException, InterruptedException {
		List<Tuple2<Tuple2<String, String>, Tuple2<String, Double>>> labelsList = labels.collect();
		LinkedList<Item> labelItems = new LinkedList<>();
		
		// delete weights table if already exists
	    Table table = db.getTable(newsTableName);
		try { 
			table.delete(); 
			table.waitForDelete(); 
		} catch (Exception e) { } 
		
		// create weights table
		try {
			Table weightsTable = db.createTable(
				newsTableName, 
				Arrays.asList(new KeySchemaElement("login", KeyType.HASH), new KeySchemaElement("article_id", KeyType.RANGE)),
				Arrays.asList(new AttributeDefinition("login", ScalarAttributeType.S), new AttributeDefinition("article_id", ScalarAttributeType.S)),
				new ProvisionedThroughput(10L, 10L)
			);
			
			weightsTable.waitForActive();
		} catch (Exception e) { }
		
		for (Tuple2<Tuple2<String, String>, Tuple2<String, Double>> label : labelsList) {
			if (!label._1._2.equals("USER")) {
				continue;
			}
			
			// write labels very 25 items in batch write
			if (labelItems.size() >= 25) {
				batchWriteItems(labelItems, db, newsTableName);
				labelItems = new LinkedList<>();
			}
			
			// add label item to list
			labelItems.add(new Item()
				.withPrimaryKey("login", label._1._1, "article_id", label._2._1)
				.withNumber("weight", label._2._2)
				.withString("date", artDates.get(label._2._1))
			);
		}
		// write remaining items
		batchWriteItems(labelItems, db, newsTableName);
	}
	
	/**
	 * Computes edgeTransferRDD normalized based on project requirements
	 * 
	 * @return edgeTransferRDD
	 */
	public JavaPairRDD<Tuple2<String, String>, Tuple2<Tuple2<String, String>, Double>> computeEdgeTransferRDD() {
		// Calculate scaling factors for type of edge (normalize over total number or a fraction of the total)
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
						// treat category and user edges from article as same for now to calculate total normalization factor
						destLabel = "CATEGORY";
					} else if (src._2.equals("CATEGORY")) {
						// treat article and user edges from article as same for now to calculate total normalization factor
						destLabel = "ARTICLE";
					}
					
					return new Tuple2<>(new Tuple2<>(src, destLabel), wt);
				})
				.reduceByKey((a, b) -> a + b)
				.mapToPair(t -> new Tuple2<>(t._1, 1.0 / t._2));
		
		// add corresponding normalization factors for article-user edges and article-category edges that were previously ignored
		nodeTransferRDD = nodeTransferRDD
			.filter(t -> t._1._1._2.equals("ARTICLE") || t._1._1._2.equals("CATEGORY"))
			.mapToPair(t -> new Tuple2<>(new Tuple2<>(t._1._1, "USER"), t._2))
			.union(nodeTransferRDD);
		
		// standard edgeTransferRDD as in page rank
		JavaPairRDD<Tuple2<String, String>, Tuple2<Tuple2<String, String>, Double>> edgeTransferRDD = edges
			.mapToPair(t -> new Tuple2<>(new Tuple2<>(t._1, t._2._2), t._2))
			.join(nodeTransferRDD)
			.mapToPair(t -> new Tuple2<>(t._1._1, t._2));
		
		return edgeTransferRDD;
	}

	/**
	 * Runs adsorption algorithm
	 * 
	 * @param localData true if read data from local file specified in config
	 * @param debug true if want to print out labels every iteration for debugging purposes
	 * @throws DynamoDbException DynamoDB is unhappy with something
	 * @throws InterruptedException User presses Ctrl-C
	 */
	public void run(boolean localData, boolean debug) throws IOException, InterruptedException {
		logger.info("Running");
		
		if (localData) {
			loadDataLocal(Config.LOCAL_NEWS_DATA_PATH);
		} else {
			loadDataDynamo();
		}
		
		if (debug) {
			nodes.foreach(t -> System.out.println("NODE: " + t));
			edges.foreach(t -> System.out.println("EDGE: " + t));
		}
			
		JavaPairRDD<Tuple2<String, String>, Tuple2<Tuple2<String, String>, Double>> edgeTransferRDD = computeEdgeTransferRDD();
		
		JavaPairRDD<Tuple2<String, String>, Tuple2<String, Double>> shadowLabels = nodes
				.filter(t -> t._2.equals("SHADOW"))
				.mapToPair(t -> new Tuple2<>(t, new Tuple2<>(t._1, 1.0)));

		JavaPairRDD<Tuple2<String, String>, Tuple2<String, Double>> labels = JavaPairRDD.fromJavaRDD(context.emptyRDD());
		
		for (int i = 1; i <= 15; i++) {
			labels = labels.union(shadowLabels);
			
			// calculate weights to propogate, schema: ((dest: (id, type), article_id), weight)
			JavaPairRDD<Tuple2<Tuple2<String, String>, String>, Double> propogateRDD = labels
				.join(edgeTransferRDD) // Schema: (src: (id, type), (label: (id, weight), (dest: (id, type), multiplier)
				.mapToPair(t -> new Tuple2<>(new Tuple2<>(t._2._2._1, t._2._1._1), t._2._1._2 * t._2._2._2));
			
			// propogate weights, schema: (node: (id, type), label: (article_id, weight))
			JavaPairRDD<Tuple2<String, String>, Tuple2<String, Double>> rawNewLabels = propogateRDD
				.reduceByKey((a, b) -> a + b) // add up propagated weights from all sources
				.mapToPair(t -> new Tuple2<>(t._1._1, new Tuple2<>(t._1._2 , t._2)));
			
			// sum up weights over all labels per node to later normalize, schema: (node: (id, type), totalWeight)
			JavaPairRDD<Tuple2<String, String>, Double> labelWeightTotals = rawNewLabels
				.mapToPair(t -> new Tuple2<>(t._1, t._2._2))
				.reduceByKey((a, b) -> a + b);
			
			// normalize labels, schema: (node: (id, type), label: (article_id, weight))
			JavaPairRDD<Tuple2<String, String>, Tuple2<String, Double>> newLabels = rawNewLabels
				.join(labelWeightTotals)
				.mapToPair(t -> new Tuple2<>(t._1, new Tuple2<>(t._2._1._1, t._2._1._2 / t._2._2)));
			
			labels = newLabels;

			System.out.println("ITERATION: " + i);
			
			if (debug) {
				labels.foreach(t -> System.out.println(t));
			}
		}
				
		// Keep only labels on users
		labels = labels.filter(t -> t._1._2.equals("USER"));
		
		System.out.println("FINISHED");
		labels.foreach(t -> System.out.println(t));
		
		if (!localData) {
			uploadLabels(labels);
		}
	}


	/**
	 * Graceful shutdown
	 */
	public void shutdown() {
		logger.info("Shutting down");

		if (spark != null) spark.close();
		
		if (db != null) db.shutdown();
	}

	public static void main(String[] args) {
		final NewsRecommendation nr = new NewsRecommendation();
		
		// Get command line arguments
		boolean localData = false;
		boolean debug = false;
		
		for (String arg : args) {
			if (arg.equals("local")) localData = true;
			if (arg.equals("debug")) debug = true;
		}
		
		try {
			nr.initialize();
			
			nr.run(localData, debug);
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
