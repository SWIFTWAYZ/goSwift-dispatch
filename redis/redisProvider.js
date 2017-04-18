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
          var delay = Math.min(times * 50, 2000);
          return delay;
          /*
              times++;
              if (times === 200) {
                 console.log("---i am giving up...");
                 done();
                return;
                }
          return 0;*/
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
     * retrieve array of parent IDs at level 12 - 14 for given leaf-id, where start-index
     * is the minimum level and no_of_levels is additional levels to maximum level
     * @param leaf_id
     * @param start_index
     * @param no_of_levels
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
            var grid_id = item.pos();
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
     * @param cell_id
     */
    var createCellPosition = function(cell_id){
        //var cell_id = driver_id.parent(DEFAULT_CELL_RESOLUTION);
        var s2cell = new s2.S2CellId(cell_id);
        if(s2cell.level() < 19){
            client.sadd(city_cells,cell_id);
        }
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
     * getCityGrid returns a list of all S2 cells at level 12-14 that makes up
     * city boundary under default constraints (min=12, max = 14, max_cells = 1000)
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
     * REDO----
     * retrieve parent_ids from the driver_cell set
     * @param driver_id
     */
    var getDriverPositions = function(){
        client.smembers(driver_cells,function(err,celldata){
            console.log("driver at level = " + ", retrieved in cell="+celldata[0]);
            return celldata;
        });
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

    var array = getParentIdArray("2203794989626726499",12,3);
    array.forEach(function(item){
            console.log("array = "+ item + "-"+item.pos());
        });

    addDriverPosition("2203795003930470261");
    addDriverPosition("2203795004670293457");
    getDriverPositions();

}).call(this);

