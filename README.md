# walkdb api

implementation with node.js

##0. prerequisite
-  node.js v0.10.x

##1. setup config

    % cp config/sample.json config/development.json
    % vi config/development.json # or production.json

```json:config/development.json
{
  "dbConnection": "postgres://user:password@db-host:port/walkdb",
  "port": 3000,
  "twitter_hashtags": "hashtag"
}
```

##2. node module setup
    % npm install

##3. start server

    % NODE_ENV=(environment) npm start

or use pm2 etc
