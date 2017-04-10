/**
 * Created by tinyiko on 2017/04/03.
 */
var DEFAULT_CELL_RESOLUTION = 10; /* 3km2 - 6km2*/

(function() {

    var redis = require("ioredis");

    var client = new redis({
      retryStrategy: function (times) {
          //setTimeout(function(){
              times++;
              if (times === 200) {
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
        riders_sortedset,
        driver_cells;

    var redisService = {};

    driver_hashset = "DRIVERS_HSET";
    riders_hashset = "RIDERS_HSET";
    driver_sortedset = "drivers:list";
    riders_sortedset = "riders:list",
    driver_cells     = "driver_cell";

    var EXPIRE_DRIVER_GPS = 3600; //60 minutes
    var EXPIRE_PASSENGER_GPS = 600; //10 minutes

    /**
     * method to add drivers to hashset
     * @param hset_name
     * @param value
     */
    var addDriverPosition = function (hset_name, value) {
        client.sadd(hset_name, value);
        //console.log("sadd.....ioredis->" + value + "to---"+hset_name);

    }

    /**
     * Create unique parent cell id each time a driver is created under
     * driver_cell set. No duplicate cell ids
     * @param driver_id
     */
    var createCellPosition = function(driver_id){
        var cell_id = driver_id.parent(DEFAULT_CELL_RESOLUTION);
        client.sadd(driver_cells,cell_id.id());
        console.log("leaf id ="+ driver_id.id()+"/added to -> cell id=" + cell_id.id());
    }

    /**
     * retrieve parent_ids from the driver_cell set
     * @param driver_id
     */
    var getDriverPositions = function(){
        client.smembers(driver_cells,function(err,celldata){
            console.log("driver at level = " + ", retrieved in cell="+celldata[0]);
            return celldata;
        })
    }

    /**
     * Retrieve all drivers that are in the cell
     * @param cellid
     */
    var getDriversInCell = function(cellid){
        client.smembers(cellid,function(err,driver_ids){
            console.log("all drivers in cell="+ cellid + "---size->"+ "--" + driver_ids);
            return driver_ids;
        })
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

    redisService.keys = keys;
    redisService.addDriverPosition = addDriverPosition;
    redisService.createCellPosition = createCellPosition;
    redisService.getDriverPositions = getDriverPositions;
    redisService.getDriversInCell = getDriversInCell;

    redisService.driver_hashset = driver_hashset;
    redisService.riders_hashset = riders_hashset;
    redisService.driver_sortedset = driver_sortedset;
    redisService.riders_sortedset = riders_sortedset;


    exports.redisService = redisService;

    //redisService.getDriverCells();
    //getAllDriversInCell("2203679687295631360");

}).call(this);

