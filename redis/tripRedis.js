/**
 * Created by tinyiko on 2017/05/16.
 */

var redis = require("ioredis");
var s2common = require("../s2geometry/s2common").s2common;
var logger = require("../config/logutil").logger;

function isEmptyObject(obj) {
    return !Object.keys(obj).length;
}

var tripService = (function(){
    var TRIP_KEY = "trip:";

var client = new redis();
    function tripService(){
    };

    tripService.isTripCreated = function(trip_id,cb){
        //hget trip:01234 vehicle_id >> hgetall trip:01234
        var key = TRIP_KEY+trip_id;
        client.hgetall(key).then(function(results){
            //logger.log(results.vehicle_id);
            cb(results);
        });
    }

    tripService.createTripKey = function(trip_id,vehicle_id,start_time,end_time){
        return new Promise(function(resolved,rejected){
            var key = TRIP_KEY+trip_id;
            if(end_time > 0 ){
                client.hmset(key,"vehicle_id",vehicle_id,"end_time",end_time).then(function(data){
                    resolved(data + "- trip ended");
                });
                return;
            }
            else {
                client.hmset(key, "vehicle_id", vehicle_id, "start_time", start_time, "end_time", end_time)
                    .then(function (results) {
                        if (results) {
                            resolved(results);
                        }
                        else {
                            rejected(results);
                        }
                        logger.log("trip_id = " + trip_id + ", timestamp = " + start_time +
                            ",results = " + results + ", start trip = " + end_time);
                    });
            }
        });
    }
    tripService.startTrip = function(trip_id,vehicle_id,start_time){
        tripService.createTripKey(trip_id,vehicle_id,start_time,0).then(function(data){
            logger.log(data);
        });
    }

    tripService.endTrip = function(trip_id,vehicle_id,end_time){
        //check if trip isValid before ending trip
        //var tt = new Date().getTime();
        tripService.createTripKey(trip_id,vehicle_id,0,end_time).then(function(data){
            logger.log(data);
        });
    }

    return tripService;
}).call(this);

exports.tripRequest = tripService;

/*var hash_table = {
    cell_id:"2203795067297071104",
    vehicle:"zdw065gp",
    timestamp:"1492783299"
};
client.hmset("vehicle:12345",hash_table);*/
//var tstamp = new Date().getTime();
//tripService.startTrip("01232","004458",tstamp);
//var tstamp = new Date().getTime();
//tripService.endTrip("01232","004458",tstamp);

//scan 0 count 3 match trip:*

tripService.isTripCreated("01234",function(results){
    logger.log(JSON.stringify(results));
    logger.log(results.vehicle_id + "-"+results.start_time);
    if(isEmptyObject(results)){
        logger.log("HGETALL returned empty");
    }
})