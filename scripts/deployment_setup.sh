cp scripts/deployment_pom.xml ./pom.xml
mvn clean package
cp scripts/pom.xml ./pom.xml
mvn compile
crontab ./scripts/crontab
sed -i -e 's/8080/80/g' web/app.js
cd web && npm install && nohup node app.js &
