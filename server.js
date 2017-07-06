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
var TChannel = require("tchannel");
var TChannelThrift = require("tchannel/as/thrift");
var fs = require("fs");
var redis = require("./redis/redisProvider").provider;
var s2circle = require("./s2geometry/s2circlecoverer");
var init = require("./config/init");
var path = require('path');
var logger = require("./config/logutil").logger;
var tripRequest = require("./api/tripRequest").tripRequest;
//var grid = null;
var tchannel_port = 4040;
var rider_radius = 2000;

var app = express();
//logger.log(JSON.stringify(init.server));

var t_server = new TChannel();
var t_client = new TChannel();

redis.getCityGrid().then(function(grid_cells){
   global.grid = grid_cells;
});

var vehiclePosition = function (id, key, lat, lon) {
    this.vehicle_id = id;
    this.s2_position = key;
    this.latitude = lat;
    this.longitude = lon;
};

var server = new TChannel({
    serviceName: "t-server"
})

var thriftChannel = new TChannelThrift({
    channel: server,
    source: fs.readFileSync(
        path.join(__dirname, './api/thrift', 'tripService.thrift'), 'utf8'
    )
});

var context = {
    logger: logger
};
thriftChannel.register(server, "tripService::getVehiclesNearRider", context, getVehiclesNearRider);
thriftChannel.register(server, "tripService::updateDriverLocation", context, updateDriverLocation)

/**
 *
 * @param context
 * @param req
 * @param head
 * @param body
 * @param callback
 */
function getVehiclesNearRider(context, req, head, body, callback) {
    logger.log("Thrift::->tripServices fired...");
    console.log("req:" + req);
    console.log("head" + JSON.stringify(head));
    console.log("body" + JSON.stringify(body));

    tripRequest.callGetVehiclesNear(body.lat, body.lon, rider_radius, global.grid, function (vehicles) {
        //response.headers.as = "raw";
        //console.log("TChannel:-> filtered vehicles size = " + JSON.stringify(vehicles));
        callback(null, {
            ok: true,
            head: head,
            body: vehicles
        });
        //response.sendOk("result", results);
    });
    /*
    var vehicles = [];
    vehicles.push(new vehiclePosition("5400", "2203792235893195177", -26.016688, 28.038357));
    vehicles.push(new vehiclePosition("5586", "2203792224202121885", -26.021435, 28.030479));*/
}

/**
 *
 * @param context
 * @param req
 * @param head
 * @param body
 * @param callback
 */
function updateDriverLocation(context, req, head, body, callback) {
    var latlng = body.lat;
    var lng = body.lon;
    var vehicle_id = body.vehicle_id;

    console.log("body" + JSON.stringify(body));
    //redis.redisAddDriverPosition2(body.vehicle_id,)
}

server.listen(4041, "127.0.0.1", function onListen() {
    console.log("listening on thrift port 4041");
});

var server_channel = t_server.makeSubChannel({
    serviceName: "server"
});

server_channel.register('function1', function onRequest(request, response, arg1, arg2) {
    logger.log(":Server-> onRequest fired : " + arg1 + "-" + arg2);
    /*if (!isNaN(arg1) && !isNaN(arg2)) {

        logger.log("arg1=" + arg1 + "/arg2=" + arg2);
        tripRequest.callGetVehiclesNear(arg1.toString(), arg2.toString(), rider_radius, global.grid, function (results) {
            response.headers.as = "raw";
            console.log("TChannel:-> filtered vehicles size = " + results.length);
            response.sendOk("result", results);
        });

    }*/
});

server_channel.register('function2', function onRequest2(request, response) {
    logger.log(":Server-> onRequest-2 fired:" + request.toString());
    response.headers.as = "raw";
    response.sendNotOk("result", "response is NOT OK");

});

t_server.listen(tchannel_port, "127.0.0.1", function onListen() {

    var lat = init.city.lat;
    var lon = init.city.lon;
    var radius = init.city.radius;
    var cityhub = init.city.name;
    var hub_centre = init.city.centre;

    logger.log("Indexing cells for " + cityhub + "," + hub_centre +
        "--[radius ->" + radius + "-centred at = " + lat + "," + lon + "]");

    s2circle.S2CircleCoverer.initialise(lat, lon, radius, function (grid_data) {
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

    function finish(err) {
        if (err) {

        }
        else {
            t_server.close();
            t_client.close();
        }

    }
});

