package edu.upenn.cis.nets2120.g36;

import java.io.IOException;
import java.io.Serializable;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.sql.Row;
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
	
	public void run() throws IOException, InterruptedException {
		logger.info("Running");
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
