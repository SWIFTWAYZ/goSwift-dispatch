/**
 * Created by tinyiko on 2017/04/03.
 */

var common = require("../commonUtil");
var s2common = require("../s2geometry/s2common");
var redis = require("ioredis");
var s2 = require("nodes2ts");
var _ = require("underscore");

(function() {

    var redisService,
        driver_cells,
        city_cells;

    var redisService = {};

    var client = new redis({
      retryStrategy: function (times) {
          var delay = Math.min(times * 50, 2000);
          return delay;
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
     *  method to add drivers to grid cells by grid_id
     *  Retrieve the s2 cell that this driver GPS location belongs to (isMemberOfGrid)
     * @param leaf_id
     */
    var addDriverPosition = function (leaf_id) {
        //check if leaf_id is S2Cell object or S2CellId object?
        var gridArray = s2common.getParentIdArray(leaf_id,12,3);
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
     * currently retrieves around 960 cells between level 12-14 when given a centre point
     * with a radius (meters) configured in config/init.js as {radius: '32000'}
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
     * names of key-spaces :-
     *
     * cells = cell_id
     * level = 12,13,14
     * vehicle location = leaf_id
     *  example =
     *  {cell_id : 2203794929858117632,
     *    level  : 12
     *   leaf_id : 2203794985692692481
     *  },
     *  {
     *    cell_id : 2203794929858117632,
     *    level  : 12
     *    leaf_id: 2203794985692692482
     *  }
     *
     *  - city_cells    - SET
     *  - small_cell:xxxxxx - SET
     *  - vehicles_location:xxxxxx (vehicle_id,timestamp,cell_id) - HASH
     *  -
     * Methods used to retrieve cellIds from redis by passing an s2cell
     * @param s2cell_id
     */
    var getCellIdsInCell = function(s2cell_id){

        var promise = new Promise(function(resolve,reject) {
            client.smembers("city_cells:"+s2cell_id).then(function(results){
                if(results){
                    var array = _.toArray(results);
                    console.log("_.toArray = " + JSON.stringify(results));
                    resolve(array);
                }
                else{
                    reject("Error = null");
                }
            }).catch(function(error){
                console.log("hgetall getCellIdsInCell error:"+ error);
            });
        });
        return promise;
        //return client.hgetall("small_cell:"+s2cell_id);
    }

    var getCellIdsInCellArray = function(s2cell_id_array){
        //check the level of s2cell grid_ids and make sure they are between 12 - 14
        //if so, query redis for cells that meet criteria
        var array = new Array();
        s2cell_id_array.forEach(function(each_cell){
            var cellIds = getCellIdsInCell(each_cell);
            arra.push(cellIds);
        });
        return array;
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

    /***
     *
     */
    var addDriverSet = function(){

        //getS2CellIdAtLevel("2203794985692692496",12);
        console.log("adding sets...");
        var hash_table = {
            cell_id:"2203795067297071104",
            vehicle:"zdw065gp",
            timestamp:"1492783299"
        };

        client.hmset("vehicle:12345",hash_table,function(result){
            console.log("hashset --- " + result);
        });
        client.hmset("vehicle:2203795003930470261","cell_id","2203795067297071104","vehicle","zdw065gp",
            "timestamp","1492783261",function(result){
                console.log("hash multi-set = " + result);
            });

        client.hgetall("vehicle:2203795003930470261",function(error,data){
            var array = _.toArray(data);
            array.forEach(function(item){
                console.log(item);
            });
            console.log("hgetting all hashes ["+ array[2] +"]-"+JSON.stringify(data));
        });
    };

    //attach methods and variables to object and export
    redisService.keys = keys;
    redisService.addDriverPosition = addDriverPosition;
    redisService.createCellPosition = createCellPosition;

    redisService.getDriverPositions = getDriverPositions;
    redisService.getDriversInCell = getDriversInCell;
    redisService.getCityGrid   = getCityGrid;

    exports.redisService = redisService;

    var array = s2common.getParentIdArray("2203794989626726499",12,3);
    array.forEach(function(item){
            console.log("array = "+ item + "-"+item.pos());
    });
    console.log("--------------break-------------");
    var arraycells = s2common.getChildrenCellIds("2203794985692692484");
    console.log("children = " + arraycells.toString());
    console.log("--------------break-------------");
    addDriverSet();
    var result = getCellIdsInCell("2203796854003466240").then(function(results){
        console.log("--------------break-------------");
        console.log("results = " + JSON.stringify(results));
    });

    /*
    addDriverPosition("2203795003930470261");
    addDriverPosition("2203795004670293457");
    getDriverPositions();
    */
    //face=0, pos=1e9573d000000004, level=29
    //face=0, pos=1e9573d010000000, level=16
    //face=0, pos=1e9573d040000000, level=15
    //2203795019878316585 - leaf

    //2203794929858117632 - level-12
    //2203794985692692480 - level-14
    //2203794985692692481/2203794985692692479/2203794985692692477 - level 15

    //2203794985692692480 - level 14
    //2203794982471467008,2203794984618950656,2203794986766434304,2203794988913917952 - level 15

    //2203794929858117632 - level 12 (see next line for its children)
    //2203794878318510080,2203794912678248448,2203794947037986816, 2203794981397725184 - level 13

    //2203794985692692484 - level-29
    //2203794985692692481,2203794985692692483,2203794985692692485,2203794985692692487 - level 30

    //2203794985692692496 - level-28
    //2203794985692692484,2203794985692692492,2203794985692692500,2203794985692692508 - level 29


    /*var result = getCellIdsInCell("2203794985692692480").then(function(resolved,rejected){
        console.log("results = " + JSON.parse(JSON.stringify(resolved)).vehicle_id);
    });*/

    /**
     * testing code.....remove once done
     */

}).call(this);

