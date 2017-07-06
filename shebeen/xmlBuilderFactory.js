/**
 * Created by tinyiko on 2017/06/04.
 */
var redis    = require("../redis/redisProvider").provider;
var s2common = require("../s2geometry/s2common").s2common;
var logger   = require("../config/logutil").logger;
var builder  = require("xmlbuilder");
var fs       = require("fs");
var path     = require("path");

var xmlBuilderFactory = (function(){

    /**
     * function to build an XMl DOM model with cellArray and GPS track
     * points and create a KML file suitable to view in Google earth.
     * TODO:
     *  - add placemark to represent the rider in the centre of the geo-circle
     *  - add customization of labels and placemarks (font and size)
     *  -
     */
    function xmlBuilderFactory(){};

    xmlBuilderFactory.createFile = function(filename,kml_buffer){
        var file = path.join(__dirname,"../../output",filename);
        fs.writeFile(file,kml_buffer,function(err){
            if(err){
                throw Error("error writing to file");
            }else{
                logger.log("successfully created file: "+file);
            }
        })
    }

    xmlBuilderFactory.createPlaceMark = function(buildersList,vehicle_id,latlng,cell_id){
        buildersList
            .ele("Placemark")
            .ele("styleUrl", "#m_ylw-pushpin").up()
        //.ele("name", s2cell_Array[index].vehicle_id).up()
            .ele("name", vehicle_id).up()
            .ele("ExtendedData")
            .ele("SchemaData").att("schemaUrl", "#GO_SWIFT_Phase_1")
            .ele("SimpleData", latlng).att("name", "GPS").up()
            .ele("SimpleData", cell_id).att("name", "s2CellId").up()
            .ele("SimpleData",cell_id).att("cell","s2cell")
            .up().up().up()
            .ele("Point")
            .ele("coordinates", latlng)
    }

    /**
     * builds XML DOM for cell polygons representing s2cells (level 12 - 16)
     * @param document_name
     * @param cellArray
     */
    xmlBuilderFactory.buildCells = function(document_name,cellGPSArray,vehicleArray,color_code,width){
        var buildersList = builder.create("kml")
            .att({"xmlns":"http://www.opengis.net/kml/2.2",
                "xmlns:gx":"http://www.google.com/kml/ext/2.2",
                "xmlns:kml":"http://www.opengis.net/kml/2.2",
                "xmlns:atom":"http://www.w3.org/2005/Atom"})
            .ele("Document")
            .ele("name",document_name).up()
            .ele("Style").att("id","default")
            .ele("LineStyle")
            .ele("color",color_code).up()
            .ele("width",width)
            .up().up().up()
            .ele("StyleMap").att("id","default0")
            .ele("Pair")
            .ele("key","normal").up()
            .ele("styleUrl","#default")
            .up().up().up();

        if(cellGPSArray !== null) {
            cellGPSArray.forEach(function (item) {

                var stringBuild = "";
                for (var i = 0; i < item.cell_vertex.length; i++) {
                    stringBuild = stringBuild + item.cell_vertex[i] + ",0 ";
                    if (i === 4) {
                        buildersList
                            .ele("Placemark")
                            .ele("name",item.s2_id).up()
                            .ele("styleUrl", "#default0").up()
                            .ele("LineString")
                            .ele("coordinates", stringBuild)
                    }
                }
                //logger.log(stringBuild);
            });
        }

        if(vehicleArray !== null) {
            vehicleArray.forEach(function (item) {
                buildersList
                    .ele("Placemark")
                    .ele("name","key").up()
                    .ele("Point")
                    .ele("coordinates", item)
            });
        }
        var xml = buildersList.end({pretty: true});

        //console.log(xml);
        //xmlBuilderFactory.createFile(document_name,xml);
    }

    /**
     * builds XML DOM for representing GPS positions of vehicles (placemarks)
     * The placemarks shows GPS, s2-cell-id and vehicle-id
     * @param document_name
     * @param cellArray
     */
     xmlBuilderFactory.buildVehicleLocations = function(document_name,rider, filteredVehicles, vehicleLatLng){
        var buildersList = builder.create("kml")
            .att({"xmlns":"http://www.opengis.net/kml/2.2",
                "xmlns:gx":"http://www.google.com/kml/ext/2.2",
                "xmlns:kml":"http://www.opengis.net/kml/2.2",
                "xmlns:atom":"http://www.w3.org/2005/Atom"})
            .ele("Document")
            .ele("name",document_name).up()

             //------------------------------------------
            //style xml for waypoints - red
            .ele("StyleMap").att("id","m_red-pushpin")
            .ele("Pair")
            .ele("key","normal").up()
            .ele("styleUrl","#s_red-pushpin").up()
            .up()
            .ele("Pair")
            .ele("key","highlight").up()
            .ele("styleUrl","#s_red-pushpin_hl").up()
            .up()
            .up()


            .ele("Style").att("id","s_red-pushpin")
            .ele("IconStyle")
            .ele("scale","0.590909").up()
            .ele("Icon")
            .ele("hotSpot").att("x","32").att("y","1").att("xunits","pixels").att("yunits","xunits").up()
            .ele("href","http://maps.google.com/mapfiles/kml/paddle/red-diamond.png").up()
            .up().up()
            .ele("ListStyle")
            .ele("ItemIcon")
            .ele("href","http://maps.google.com/mapfiles/kml/paddle/red-diamond-lv.png").up()
            .up()
            .up()
            .up()

            .ele("Style").att("id","s_red-pushpin_hl")
            .ele("IconStyle")
            .ele("scale","0.590909").up()
            .ele("Icon")
            .ele("hotSpot").att("x","32").att("y","1").att("xunits","pixels").att("yunits","xunits").up()
            .ele("href","http://maps.google.com/mapfiles/kml/paddle/red-diamond.png").up()
            .up().up()
            .ele("ListStyle")
            .ele("ItemIcon")
            .ele("href","http://maps.google.com/mapfiles/kml/paddle/red-diamond-lv.png").up()
            .up()
            .up()
            .up()

            //---------------------------------------------

            //style xml for waypoints - yellow
            .ele("Style").att("id","s_ylw-pushpin_hl")
             .ele("IconStyle")
             .ele("color",'ff4038fc').up()
             .ele("scale","0.590909")
             .ele("Icon")
            .ele("hotSpot").att("x","32").att("y","1").att("xunits","pixels").att("yunits","xunits").up()
             .ele("href","http://maps.google.com/mapfiles/kml/paddle/wht-stars.png").up()
             .up().up().up().up()

            .ele("StyleMap").att("id","m_ylw-pushpin")
             .ele("Pair")
            .ele("key","normal").up()
            .ele("styleUrl","#s_ylw-pushpin").up()
            .up().up()

            //cellArray.forEach(function(item,index){
         filteredVehicles.forEach(function(item,index){
                //if(s2cell_Array[index] !== undefined) {
                    //logger.log("results index = " + index + "-" + JSON.stringify(item));
             logger.log("filteredVehicles = " + JSON.stringify(item));

                    buildersList
                        .ele("Placemark")
                        //.ele("styleUrl", "#m_ylw-pushpin").up()
                        .ele("styleUrl", "#m_red-pushpin").up()
                        //.ele("name", item.vehicle_id).up()
                        .ele("ExtendedData")
                        .ele("SchemaData").att("schemaUrl", "#GO_SWIFT_Phase_1")
                        .ele("SimpleData",item.vehicle_id).att("name","vehicle_id").up()
                        .ele("SimpleData", vehicleLatLng[index]).att("name", "GPS").up()
                        .ele("SimpleData", item.cell_id+"").att("name", "s2CellId")
                        .up().up().up()
                        .ele("Point")
                        .ele("coordinates", vehicleLatLng[index])
                //}
            });
        xmlBuilderFactory.createPlaceMark(buildersList,"rider:002",rider,"0000");
        var xml = buildersList.end({pretty: true});
        //console.log(xml);
        //xmlBuilderFactory.createFile(document_name,xml);
    }

    return xmlBuilderFactory;
}).call(this);

exports.xmlBuilderFactory = xmlBuilderFactory;

//xmlBuilderFactory.buildVehicleLocations("waypoints.kml",waypoints,cells);

//--- get all cells and build the joburg city grid kml file
var cells = redis.getCityGrid(function(cells){
    var s2cells = s2common.createCellRectArray(cells);
    //xmlBuilderFactory.buildCells("S2_JHB_grid_cells.kml",s2cells,null,"#ff4038fc","2.1");

});

