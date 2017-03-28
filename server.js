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
var redis = require("ioredis");
var serverConfig = require("./config/init");

var app = express();
console.log(JSON.stringify(serverConfig));

app.set("port",process.env.PORT||serverConfig['serverConfig']['port']);

app.listen(app.get('port'),function(err,data){

    if(err){
        console.error("error message ->" + err);
        return;
    }
    console.log("running on port "  + app.get('port'));

});

app.all("*",function(req,res){
        console.log("request coming ...." + req);
        res.sendStatus(200);
});

