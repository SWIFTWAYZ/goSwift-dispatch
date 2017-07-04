/**
 * Created by tinyiko on 2017/03/28.
 */
/**
 * Dispatch module for taxi request dispatching and queuing.
 * Some of the functions of this module are listed below:-
 *
 * -Search closest drivers using redis (i.e. memcache)
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
var Tchannel = require("tchannel");
var redis = require("./redis/redisProvider").provider;
var s2circle = require("./s2geometry/s2circlecoverer");
var init = require("./config/init");
//var uuid = require('node-uuid');
var path = require('path');
var logger = require("./config/logutil").logger;
var tripRequest = require("./api/tripRequest").tripRequest;
//var grid = null;
var tchannel_port = 4040;

var app = express();
logger.log(JSON.stringify(init.server));

var t_server = new Tchannel();
var t_client = new Tchannel();

var server_channel = t_server.makeSubChannel({
    serviceName: "server"
});

server_channel.register('function1',function onRequest(request,response,arg1,arg2){
   logger.log(":Server-> onRequest fired : "+ arg1 + "-"+arg2);
   if(!isNaN(arg1) && !isNaN(arg2)) {
       var rider_radius = 2000;
       logger.log("arg1="+arg1 +"/arg2="+arg2 );
       redis.getCityGrid().then(function(grid) {
           tripRequest.callGetVehiclesNear(arg1.toString(), arg2.toString(), rider_radius, grid,function(results){
               response.headers.as = "raw";
               console.log("TChannel:-> filtered vehicles size = "+results.length);
               response.sendOk("result",results);
           });
       });
   }

});

server_channel.register('function2',function onRequest2(request,response){
    logger.log(":Server-> onRequest-2 fired:"+request.toString());
    response.headers.as = "raw";
    response.sendNotOk("result","response is NOT OK");

});

t_server.listen(tchannel_port,"127.0.0.1",function onListen() {

    var lat = init.city.lat;
    var lon = init.city.lon;
    var radius = init.city.radius;
    var cityhub = init.city.name;
    var hub_centre = init.city.centre;

    logger.log("Indexing cells for " + cityhub + "," + hub_centre +
        "--[radius ->" + radius + "-centred at = " + lat + "," + lon + "]");

    s2circle.S2CircleCoverer.initialise(lat, lon, radius,function(grid_data){
        global.grid = grid_data;
    });
    logger.log("TChannel server running on port:" + tchannel_port);

    var client_channel = t_client.makeSubChannel({
        serviceName: 'server',
        peers: [t_server.hostPort],
        requestDefaults: {
            hasNoParent: true,
            headers: {
                'as': 'raw',
                'cn': 'example-client'
            }
        }
    });

    /*
   client_channel.request({
            serviceName: "server",
            timeout: 1000
    }).send('function1','argument 1','argument 2',function onResponse(err,response,arg2,arg3){
        if(err){
            console.log("function1 error ->" + err);
            finish(err);
        }
        else{
            console.log(":Client->function1 response ->"+ response + "from server-"+String(arg3))

        }
    });

    client_channel.request({
        serviceName: "server",
        timeout: 1000
    }).send('function1',"arg 1","arg 2",function onResponse(err,response,arg2,arg4){
        if(err){
            console.log("function2 error ->"+err);
        }
        console.log(":Client->function2 response ->" + response);
    });
*/

    function finish(err){
        if(err){

        }
        else{
            t_server.close();
            t_client.close();
        }

    }
});

var cityInitialize = function(){

}
//----------------------setup a express server --------

/*
app.set("port", process.env.PORT || init.server['port']);

app.listen(app.get('port'), function (err, data) {
    if (err) {
        console.error("error message ->" + err);
        return;
    }

    var lat = init.city.lat;
    var lon = init.city.lon;
    var radius = init.city.radius;
    var cityhub = init.city.name;
    var hub_centre = init.city.centre;

    logger.log("Indexing cells for " + cityhub + "," + hub_centre +
        "--[radius ->" + radius + "-centred at = " + lat + "," + lon + "]");

    s2circle.S2CircleCoverer.initialise(lat, lon, radius);
    logger.log("server running on port:" + init.server.port);
});

app.all("*", function (req, res) {
    logger.log("request coming ...." + req);
    res.send("responding with text....." + JSON.stringify(init));
    //res.sendStatus(200);
});

*/