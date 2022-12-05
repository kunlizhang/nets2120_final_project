package edu.upenn.cis.nets2120.g36.livy;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.concurrent.ExecutionException;

import org.apache.livy.LivyClient;
import org.apache.livy.LivyClientBuilder;

import edu.upenn.cis.nets2120.config.Config;

public class NewsRecommendationLivy {
	public static void main(String[] args) throws IOException, URISyntaxException, InterruptedException, ExecutionException {
		
		LivyClient client = new LivyClientBuilder()
			.setURI(new URI(Config.EC2_URL))
			.build();

		try {
			String jar = "target/nets2120-g36-0.0.1-SNAPSHOT.jar";
			
			System.out.printf("Uploading %s to the Spark context...\n", jar);
			client.uploadJar(new File(jar)).get();
			
			System.out.printf("Running NewsRecommendationJob...\n");
			client.submit(new NewsRecommendationJob(7)).get();
		} catch (Throwable e) {
			System.out.println("Error");
		}
		
		client.stop(true);
	}
}
