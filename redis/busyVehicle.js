/**
 * Created by tinyiko on 2017/05/18.
 */

var redis = require("ioredis");
var s2common = require("../s2geometry/s2common").s2common;
var logger = require("../config/logutil").logger;

var client = new redis();

var busyVehicle = (function(){
    var BUSY_KEY = "busy_vehicles";

    function busyVehicle(){};

    busyVehicle.getBusy = function(vehicle_id,timestamp,cb){
            client.zadd(BUSY_KEY,timestamp,vehicle_id).then(function(results){
            logger.log(results);
            cb(results);
        }).catch(function(error){
                logger.log(error);
        });
    }

    busyVehicle.beFree = function(vehicle_id,cb){
            client.zrem(BUSY_KEY,vehicle_id).then(function(results){
                logger.log("vehicle_id removed - >" + vehicle_id);
            });
    }

    busyVehicle.isBusy = function(vehicle_id,cb){
        client.zscore(BUSY_KEY,vehicle_id).then(function(results){
            if(results){
                cb(true);
            }
            else{
                cb(false);
            }
        });
    }

    return busyVehicle;
}).call(this);

exports.busyVehicle = busyVehicle;

var time = new Date().getTime();
logger.log("timestamp = " + time);
busyVehicle.getBusy("004459",time,function(results){
    logger.log(results);
});

busyVehicle.isBusy("004451",function(status){
    logger.log("is vehicle busy : "+status);
});

busyVehicle.beFree("004458",function(results){
    logger.log("removed ? =" +results);
})