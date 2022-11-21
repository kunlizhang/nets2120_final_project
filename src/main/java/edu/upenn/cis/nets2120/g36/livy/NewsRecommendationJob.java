package edu.upenn.cis.nets2120.g36.livy;

import java.io.IOException;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.apache.livy.Job;
import org.apache.livy.JobContext;
import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.sql.SparkSession;

import edu.upenn.cis.nets2120.config.Config;
import edu.upenn.cis.nets2120.storage.SparkConnector;
import scala.Tuple2;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;

public class NewsRecommendationJob implements Job<List<MyPair<Integer,Double>>> {
	/**
	 * 
	 */
	private static final long serialVersionUID = 1L;

	/**
	 * Connection to Apache Spark
	 */
	SparkSession spark;
	
	JavaSparkContext context;
	
	/**
	 * Initialize the database connection and open the file
	 * 
	 * @throws IOException
	 * @throws InterruptedException 
	 * @throws DynamoDbException 
	 */
	public void initialize() throws IOException, InterruptedException {
		System.out.println("Connecting to Spark...");
		spark = SparkConnector.getSparkConnection();
		context = SparkConnector.getSparkContext();
		
		System.out.println("Connected!");
	}
	
	public List<MyPair<Integer,Double>> run() throws IOException, InterruptedException {
		return null;
	}

	
	public NewsRecommendationJob() {
		System.setProperty("file.encoding", "UTF-8");
	}

	@Override
	public List<MyPair<Integer,Double>> call(JobContext arg0) throws Exception {
		initialize();
		return run();
	}

}
