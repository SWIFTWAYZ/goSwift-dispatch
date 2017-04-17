/**
 * Created by tinyiko on 2017/04/03.
 */
var DEFAULT_CELL_RESOLUTION = 12; /* 3km2 - 6km2*/

(function() {

    var redis = require("ioredis");
    var swift = require("../constants");
    var s2 = require("nodes2ts");

    var redisService,
        driver_hashset,
        riders_hashset,
        driver_sortedset,
        riders_sortedset,
        driver_cells,
        city_cells;

    var redisService = {};

    driver_sortedset = "drivers:list";
    riders_sortedset = "riders:list";
    driver_cells     = "driver_cell";
    city_cells       = "city_cells";

    var EXPIRE_DRIVER_GPS = 3600; //60 minutes
    var EXPIRE_PASSENGER_GPS = 600; //10 minutes

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

    client.on('error',function(err,data){
        if(err.message.startsWith("connect ECONNREFUSED")){
            console.log("server connection failed...");
        };
    });

    client.on("connect",function(){
        console.log("redis server connection succeeded...");
    });

    /**
     * retrieve array of parent IDs at level 12 - 14 for given leaf-id
     * @param leaf_id
     * @returns {null}
     */
    var getParentIdArray = function(leaf_id, start_index, no_of_levels){
        var s2cell = new s2.S2CellId(leaf_id);
        var parentCellsArray = new Array();
        if(s2cell.isLeaf()){
            var total = start_index + no_of_levels;
            for(var i = start_index; i < total; i++){
                var parent12 = s2cell.parentL(i);
                parentCellsArray.push(parent12);
            }
        }
        return parentCellsArray;
    }

    /**
     *  method to add drivers to grid cells by grid_id
     * @param leaf_id
     */
    var addDriverPosition = function (leaf_id) {
        var gridArray = getParentIdArray(leaf_id,12,3);
        //could use client.sinter (set intersection) for grid cell where to add driver
        gridArray.forEach(function(item){
            var grid_id = item.id.toString();
            isMemberOfGrid(grid_id).then(function (resolve, reject) {
                if (resolve) {
                    client.sadd("city_cells:" + grid_id, leaf_id);
                    console.log("adding driver id = " + leaf_id + "-- to grid=" + grid_id);
                }
            });
        });
    }

    /**
     * Create unique parent cell id each time a driver is created under
     * driver_cell set. No duplicate cell ids
     * @param driver_id
     */
    var createCellPosition = function(cell_id){
        //var cell_id = driver_id.parent(DEFAULT_CELL_RESOLUTION);
        client.sadd(city_cells,cell_id);
        //console.log(city_cells + ": adding id ="+ cell_id+"/to city grid");
    }

    /**
     * Check if cell id is a member of the city_cells set
     * @param cell_id
     * @returns {*}, true if member and false if not member
     */
    var isMemberOfGrid = function(cell_id) {

        return client.sismember(city_cells, cell_id).then(function (resolve, reject) {
            if(resolve)
            return true;
            return false;
        });
    }

    /**
     * getCityGrid returns a list of all S2 cells at level 12 that makes up
     * city boundary under default constraints (min=12, max = 26, max_cells = 500)
     * @returns {*}
     */
    var getCityGrid = function(){
        return client.smembers(city_cells,function(err,data){
            console.log("retrieving city cells = " + data.length);
            //cb(data);
        }).then(function(resolved,rejected){
            if(resolved) {
                //console.log("resolved getCityGrid---" + resolved);
                return resolved;
            }
        });
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
        client.sismember(city_cells, cellid, function(error,driver_ids){
            if(error){
                console.log("error = " + error);
                throw new Error(error);
            }
            console.log("all drivers in cell="+ cellid + "---size->"+ "--" + error+ "-"+driver_ids);
            return driver_ids;
        });
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
    redisService.getCityGrid   = getCityGrid;

    redisService.driver_hashset = driver_hashset;
    redisService.riders_hashset = riders_hashset;
    redisService.driver_sortedset = driver_sortedset;
    redisService.riders_sortedset = riders_sortedset;


    exports.redisService = redisService;

    //redisService.getDriverCells();
    //getDriversInCell("2203679687295631360");
    //
    // getDriversInCell("2203694324544176128");
    //getParentIdArray("2203694324544176128");

    var array = getParentIdArray("2203794989626726499",12,3);
    array.forEach(function(item){
            console.log("array = "+ item + "-"+item.id.toString());
        });

    //addDriverPosition("2203672884067434496");
    //addDriverPosition("2203795001640038161");
    //addDriverPosition("2203795001640038162");
    //addDriverPosition("2203795001640038163");

    /*addDriverPosition("2203794989626726499");*/
    addDriverPosition("2203795003930470261");
    addDriverPosition("2203795004670293457");

}).call(this);

//sadd - "2203795001640038161","0847849574","2017-04-16:11:23:24","0012349999"
//sinter - intersections of sets
//sismember - check if is member of set
//sort - sort members of set
//exists - check if key exists in redis
//smove - move a member from one set to another
//sdiff - subtract multiple sets
//scard - count members of set
//RPUSH key value - push specified values at the tail of the list stored at key
//SETEX - Set key to hold the string value and set key to timeout after