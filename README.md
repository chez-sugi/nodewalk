
##0. prerequisite
  node.js
  postgresql
  postgis 1.5 or higher

##1. create database and install postgis functions.

    % createdb walkdb -E utf8
    % createlang -d walkdb plpgsql
    % psql walkdb -f lwpostgis.sql
    % psql walkdb -f spatial_ref_sys.sql
    % psql walkdb -f sql/schema.sql

##2. setup config

    % cp config/sample.json config/development.json
    % vi config/development.json

```json:config/development.json
{
  "dbConnection": "postgres://user:password@localhost:5433/walkdb",
  "port": 3000,
  "twitter_hashtags": "お散歩テスト"
}
```

##3. node module setup
    % npm install

##4. setup areas table
 in case of using japan.shp, visit http://www.esrij.com/products/gis_data/japanshp/japanshp.html and download zip file japan_ver70.zip. then extract japan_ver70.shp to a working directory.
 
    % shp2pgsql -s 4326 -g the_geom -I -W sjis japan_ver62.shp areas > areas.sql
    % psql walkdb -f areas.sql

6. start server

    % npm start

 demo: http://dev.walk.chez-sugi.net/

