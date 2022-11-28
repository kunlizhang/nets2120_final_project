package edu.upenn.cis.nets2120.g36.loader;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.util.List;
import java.util.Scanner;
import java.util.LinkedList;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.UUID;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import org.json.JSONObject;

import com.amazonaws.services.dynamodbv2.document.BatchWriteItemOutcome;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.ProvisionedThroughput;
import com.amazonaws.services.dynamodbv2.model.ResourceInUseException;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;

import edu.upenn.cis.nets2120.config.Config;
import opennlp.tools.stemmer.PorterStemmer;
import opennlp.tools.stemmer.Stemmer;
import opennlp.tools.tokenize.SimpleTokenizer;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;


public class NewsLoader {
	static Logger logger = LogManager.getLogger(NewsLoader.class);

    final static String newsTableName = "news";
	final static String catTableName = "news_categories";
	final static String kwdTableName = "news_keywords";
    
	DynamoDB db;
	Table newsTable;
	Table catTable;
	Table kwdTable;

	BufferedReader newsArticles;
	
	SimpleTokenizer tokenizer;
	Stemmer stemmer;
	List<String> stopWords;
	
	/**
	 * Initialize with the default loader path
	 */
	public NewsLoader() {
		String path = Config.NEWS_DATASET_PATH;
		final File f = new File(path);
		
		if (!f.exists())
			throw new RuntimeException("Can't load without the news dataset file");
		
		tokenizer = SimpleTokenizer.INSTANCE;
		stemmer = new PorterStemmer();
		
		// Read stop words
		try {
			File file = new File("src/main/resources/nlp_en_stop_words.txt");
			Scanner scan = new Scanner(file);
			stopWords = new ArrayList<>();
			while (scan.hasNextLine()) {
				stopWords.add(scan.nextLine());
			}
			scan.close();
		} catch (FileNotFoundException e) {
			// If file doesn't exist use default set
			stopWords = Arrays.asList("a", "all", "any", "but", "the");
		}
	}

	/**
	 * Initialize the database connection and open the file
	 * 
	 * @throws IOException
	 * @throws InterruptedException 
	 * @throws DynamoDbException 
	 */
	public void initialize() throws IOException, DynamoDbException, InterruptedException {
		logger.info("Connecting to DynamoDB...");
		db = DynamoConnector.getConnection(Config.DYNAMODB_URL);
		logger.debug("Connected!");
		
		logger.info("Intializing tables...");
		initializeTables();
		logger.info("Tables initialized!");

		newsArticles = new BufferedReader(new FileReader(Config.NEWS_DATASET_PATH));
	}
	
	/**
	 * Initializes necessary tables in DynamoDB if they do not already 	exist
	 * 
	 * @throws DynamoDbException DynamoDB is unhappy with something
	 * @throws InterruptedException User presses Ctrl-C
	 */
	private void initializeTables() throws DynamoDbException, InterruptedException {
		// Create main news table
		try {
			newsTable = db.createTable(
				newsTableName, 
				Arrays.asList(new KeySchemaElement("article_id", KeyType.HASH)),																											// key
				Arrays.asList(new AttributeDefinition("article_id", ScalarAttributeType.S)),
				new ProvisionedThroughput(100L, 100L)
			);
			
			newsTable.waitForActive();
		} catch (final ResourceInUseException exists) {
			newsTable = db.getTable(newsTableName);
		}
		
		// Create categories table
		try {
			catTable = db.createTable(
				catTableName,
				Arrays.asList(new KeySchemaElement("category", KeyType.HASH), new KeySchemaElement("article_id", KeyType.RANGE)),
				Arrays.asList(new AttributeDefinition("category", ScalarAttributeType.S), new AttributeDefinition("article_id", ScalarAttributeType.S)),
				new ProvisionedThroughput(100L, 100L)
			);
			
			catTable.waitForActive();
		} catch (final ResourceInUseException exists) {
			catTable = db.getTable(newsTableName);
		}
		
		// Create keywords table
		try {
			kwdTable = db.createTable(
				kwdTableName,
				Arrays.asList(new KeySchemaElement("keyword", KeyType.HASH), new KeySchemaElement("article_id", KeyType.RANGE)),
				Arrays.asList(new AttributeDefinition("keyword", ScalarAttributeType.S), new AttributeDefinition("article_id", ScalarAttributeType.S)),
				new ProvisionedThroughput(100L, 100L)
			);
			
			kwdTable.waitForActive();
		} catch (final ResourceInUseException exists) {
			kwdTable = db.getTable(kwdTableName);
		}
	}
	
	/**
	 * Batch write up to 25 items
	 * 
	 * @throws DynamoDbException DynamoDB is unhappy with something
	 * @throws InterruptedException User presses Ctrl-C
	 */
	private void batchWriteItems(List<Item> items, String tableName) throws DynamoDbException, InterruptedException {
		// Quite early if items empty or too many
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
	 * Main functionality in the program: read news from JSON and
	 * populate corresponding main and auxiliary DynamoDB table
	 * 
	 * @throws IOException File read, network, and other errors
	 * @throws DynamoDbException DynamoDB is unhappy with something
	 * @throws InterruptedException User presses Ctrl-C
	 */
	public void run() throws IOException, DynamoDbException, InterruptedException {
		logger.info("Running");
		
		String line;
		LinkedList<Item> newsItems = new LinkedList<>();
		LinkedList<Item> catItems = new LinkedList<>();
		LinkedList<Item> kwdItems = new LinkedList<>();
		
		String prev = "";
		while ((line = newsArticles.readLine()) != null) {
			// Batch write if 25 items
			if (newsItems.size() >= 25 || catItems.size() >= 25) {
				batchWriteItems(newsItems, newsTableName);
				batchWriteItems(catItems, catTableName);
				newsItems = new LinkedList<>();
				catItems = new LinkedList<>();
			}
			
			// Read json and generate UUID from json, ensuring uuid is not duplicate
			JSONObject json = new JSONObject(line);
			String uuid = UUID.nameUUIDFromBytes(json.toString().getBytes()).toString();
			if (uuid.equals(prev))
				continue;
			prev = uuid;
			
			// Add 5 years to date, handling leap year (just turn to 28th)
			String date = json.getString("date");
			date = date.equals("2016-02-29") ? "2021-02-28" : (Integer.parseInt(date.substring(0, 4)) + 5) + date.substring(4);

			// Add news item
			newsItems.add(new Item()
				.withPrimaryKey("article_id", uuid)
				.withString("headline", json.getString("headline"))
				.withString("category", json.getString("category"))
				.withString("authors", json.getString("authors"))
				.withString("link", json.getString("link"))
				.withString("description", json.getString("short_description"))
				.withString("date", date)
			);
			
			// Add category item
			catItems.add(new Item().withPrimaryKey("category", json.getString("category"), "article_id", uuid));
			
			// Tokenize and iterate over words in headline
			String[] tok = tokenizer.tokenize(json.getString("headline"));
			LinkedList<String> words = new LinkedList<>();
			for (String word : tok) {				
				word = word.toLowerCase();
				// Check if has non-alphabetic characters or is stop word
				if (!word.matches("[A-Za-z]+") || stopWords.contains(word)) {
					continue;
				}
				word = (String) stemmer.stem(word);
				
				if (!words.contains(word))
					words.add(word);
			}
			
			// Write keywords to table
			for (String word : words) {
				if (kwdItems.size() >= 25) {
					batchWriteItems(kwdItems, kwdTableName);
					kwdItems = new LinkedList<>();
				}
				kwdItems.add(new Item().withPrimaryKey("keyword", word, "article_id", uuid));
			}
		}
		// Write remaining items not in set of 25
		batchWriteItems(newsItems, newsTableName);
		batchWriteItems(catItems, catTableName);
		batchWriteItems(kwdItems, kwdTableName);
		
		logger.info("*** Finished reading news dataset! ***");
	}

	/**
	 * Graceful shutdown
	 */
	public void shutdown() {
		logger.info("Shutting down");
		try {
			newsArticles.close();
		} catch (final IOException e) {
			e.printStackTrace();
		}
		DynamoConnector.shutdown();
	}

	public static void main(final String[] args) {
		final NewsLoader ld = new NewsLoader();

		try {
			ld.initialize();

			ld.run();
		} catch (final IOException ie) {
			logger.error("I/O error: ");
			ie.printStackTrace();
		} catch (final DynamoDbException e) {
			e.printStackTrace();
		} catch (final InterruptedException e) {
			e.printStackTrace();
		} finally {
			ld.shutdown();
		}
	}
}