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

var http = require("http");
var express = require("express");
var redis = require("./redis/redisProvider");
var s2circle = require("./s2geometry/s2circlecoverer");
var server = require("./config/init");
var uuid = require('node-uuid');
var path = require('path');

var app = express();
console.log(JSON.stringify(server));

app.set("port",process.env.PORT||server['port']);

app.listen(app.get('port'),function(err,data){
    if(err){
        console.error("error message ->" + err);
        return;
    }

    var lat = parseFloat(server['city']['lat']);
    var lon = parseFloat(server['city']['lon']);
    var radius = parseFloat(server['city']['radius']);
    var cityhub = server.city.name;
    var hub_centre = server.city.centre;

    console.log("Indexing cells for " + cityhub + ","+hub_centre +
        "--[radius ->" + radius + "-centred at = "+lat + ","+lon+"]");
    var city_grid = s2circle.S2CircleCoverer.getCovering(lat,lon,radius,12,26,1000);
    city_grid.forEach(function(city_cell){
        redis.redisService.createCellPosition(city_cell.id);
    });

    console.log("server running on port:"  + app.get('port'));
});

app.all("*",function(req,res){
        console.log("request coming ...." + req);
        res.send("responding with text....." + JSON.stringify(serverConfig));
        //res.sendStatus(200);
});

