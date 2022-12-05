package edu.upenn.cis.nets2120.g36.loader;

import com.amazonaws.auth.DefaultAWSCredentialsProviderChain;
import com.amazonaws.client.builder.AwsClientBuilder;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBClientBuilder;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;

import edu.upenn.cis.nets2120.config.Config;

/**
 * A factory 
 * @author zives
 *
 */
public class DynamoConnector {
	/**
	 * This is our connection
	 */
	static DynamoDB client;

	/**
	 * Singleton pattern: get the client connection if one exists, else create one
	 * 
	 * @param url
	 * @return
	 */
	public static DynamoDB getConnection(final String url) {
		if (client != null)
			return client;
		
    	client = new DynamoDB( 
    			AmazonDynamoDBClientBuilder.standard()
				.withEndpointConfiguration(new AwsClientBuilder.EndpointConfiguration(
					Config.DYNAMODB_URL, "us-east-1"))
    			.withCredentials(new DefaultAWSCredentialsProviderChain())
				.build());

    	return client;
	}
	
	/**
	 * Orderly shutdown
	 */
	public static void shutdown() {
		if (client != null) {
			client.shutdown();
			client = null;
		}
	}
}
