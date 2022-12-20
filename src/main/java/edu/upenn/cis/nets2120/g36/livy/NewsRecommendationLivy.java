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
		int daysHistory = 14;
		
		if (args.length == 1) {
			try {
				int parsed = Integer.parseInt(args[0]);
				daysHistory = parsed;
			} catch (NumberFormatException e) { }
		}
		
		LivyClient client = new LivyClientBuilder()
			.setURI(new URI(Config.EMR_URL))
			.build();

		try {
			String jar = "target/submit-g36.jar";
			
			System.out.printf("Uploading %s to the Spark context...\n", jar);
			client.uploadJar(new File(jar)).get();
			
			System.out.printf("Running NewsRecommendationJob...\n");
			client.submit(new NewsRecommendationJob(daysHistory)).get();
		} catch (Throwable e) {
			e.printStackTrace();
			Thread.sleep(5000);
		}
		
		client.stop(true);
	}
}
