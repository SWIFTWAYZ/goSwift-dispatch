/**
 * Created by tinyiko on 2017/04/03.
 */

(function() {

    var redis = require("ioredis");

    var client = new redis({
      retryStrategy: function (times) {
          //setTimeout(function(){
              times++;
              if (times === 500) {
                 console.log("---i am giving up...");
                 done();
                return;
                }
          //},1000);
          //console.log("attempting to connect...");
          return 0;
        }
      });

    var done = function(){};
    client.on('error',function(err,data){
        if(err.message.startsWith("connect ECONNREFUSED")){
            console.log("server connection failed...");
        };
    });

    client.on("connect",function(){
        console.log("redis server connection succeeded...");
    })
    var redisService,
        driver_hashset,
        riders_hashset,
        driver_sortedset,
        riders_sortedset

    var redisService = {};

    driver_hashset = "DRIVERS_HSET";
    riders_hashset = "RIDERS_HSET";
    driver_sortedset = "drivers:list";
    riders_sortedset = "riders:list";

    var EXPIRE_DRIVER_GPS = 3600; //60 minutes
    var EXPIRE_PASSENGER_GPS = 600; //10 minutes

    /**
     * method to add drivers to hashset
     * @param hset_name
     * @param value
     */
    var hsetAdd = function (hset_name, value) {
        client.sadd(hset_name, value);
        //console.log("sadd.....ioredis->" + value + "to---"+hset_name);

    }

    /**
     * retrieve keys from driver hashset
     * @type {Array}
     */
    var keys = function(cb){
        client.keys(driver_hashset, function (err, data) {
            console.log("logging keys ->" + data);
            cb(data);
        });
    }

    //attach methods and variables to object and export
    redisService.hsetAdd = hsetAdd;
    redisService.keys = keys;

    redisService.driver_hashset = driver_hashset;
    redisService.riders_hashset = riders_hashset;
    redisService.driver_sortedset = driver_sortedset;
    redisService.riders_sortedset = riders_sortedset;

    exports.redisService = redisService;

}).call(this);