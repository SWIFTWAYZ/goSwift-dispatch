/**
 * Created by tinyiko on 2017/03/28.
 */
/**
 * Dispatch module for taxi request dispatching and queuing.
 * Some of the functions of this module are listed below:-
 *
 * -Search closest drivers using memcache like redis
 * -Do all distance calculations
 * -Push distance/trip logs to billing engine using RabbitMQ
 * -Log all gps data
 * -Push to RabbitMQ
 * -Kalmer filter (algorithm to smooth gps points along a route)
 * -Rider/driver matching algorithms when doing car pooling
 * -Optimal route estimates
 * -Display driver location to riders all the time in real-time
 * -Keep trip logs in redis hash-map
 * -Keep driver logs in redis hash-map
 * -Keep rider logs in redis hash-map
 * -
 * Author: Tinykov
 */
"use strict";

var http = require("http");
var express = require("express");
//var redis = require("./redis/redisProvider");
var s2circle = require("./s2geometry/s2circlecoverer");
var init = require("./config/init");
var uuid = require('node-uuid');
var path = require('path');
var logger = require("./config/logutil").logger;

var app = express();
logger.log(JSON.stringify(init.server));

app.set("port",process.env.PORT||init.server['port']);

app.listen(app.get('port'),function(err,data){
    if(err){
        console.error("error message ->" + err);
        return;
    }

    var lat = init.city.lat;
    var lon = init.city.lon;
    var radius = init.city.radius;
    var cityhub = init.city.name;
    var hub_centre = init.city.centre;

    logger.log("Indexing cells for " + cityhub + ","+hub_centre +
        "--[radius ->" + radius + "-centred at = "+lat + ","+lon+"]");

    s2circle.S2CircleCoverer.initialise(lat,lon,radius);
    logger.log("server running on port:"  + init.server.port);
});

app.all("*",function(req,res){
        logger.log("request coming ...." + req);
        res.send("responding with text....." + JSON.stringify(init));
        //res.sendStatus(200);
});

