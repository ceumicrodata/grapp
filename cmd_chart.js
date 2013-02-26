  
function cmd_chart(selection, settingLevels ) {

  var chartTitle = selection.select(".chartTitle");
  var chartDescription = selection.select(".chartDescription");
  var buttonContainer = selection.select(".chartButtons");
 
  selection.select(".chartContainer").each(function() { 

    var series = new Object();
    
    var speed = 500;
    var margin = 20;
    
    var currentLevel = 0;
    var settings = settingLevels[0];

    var timeFrom = 0;
    var timeTo =   100;
    var valueFrom = 0;
    var valueTo =   100;
    
    function updateRanges() {
      if (settings.dateFrom)
        timeFrom = settings.dateFormat.parse(settings.dateFrom).getTime();
      if (settings.dateTo)
        timeTo =   settings.dateFormat.parse(settings.dateTo).getTime();
      if (settings.valueFrom)
        valueFrom = settings.valueFrom;
      if (settings.valueTo)
        valueTo =   settings.valueTo;
    }  
    
    updateRanges();
  
    var totalWidth  = $(this).width() ; 
    var totalHeight = $(this).height() ;

    var width  = totalWidth - 2*margin; 
    var height = totalHeight - 2*margin;

    function getTimeScale() {
      return d3.time.scale()
        .domain([timeFrom,timeTo])
        .range([0,width]);
    }
    function getValueScale() {
      return d3.scale.linear()
        .domain([valueFrom,valueTo])
        .range([height,0]);
    }    
    
    var scalesTime = getTimeScale();
    var scalesValue = getValueScale();
 
    var xAxis = d3.svg.axis()
    .scale(scalesTime)
    .orient("bottom")
    .tickPadding(6)
    .tickSize(height);

    var yAxis = d3.svg.axis()
    .scale(scalesValue)
    .orient("left")
    .tickPadding(3)
    .tickSize(width);

    
    /*var xAxisBackground = d3.svg.axis()
    .scale(scalesTime)
    .orient("top")
    .ticks(d3.time.years, 1)
    .tickSubdivide(1)
    .tickSize(width);
    
    var yAxisBackground = d3.svg.axis()
    .scale(scalesValue)
    .orient("right")
    .ticks(5)
    .tickSubdivide(1)
    .tickSize(width);*/
   
    ////////////////
    
    function loadDataAndRedraw(from, to, levelUpFromSerie, levelDownToSerie) { 
      
      if (levelUpFromSerie) {
        currentLevel ++;
        settings = settingLevels[currentLevel]; 
        settings.grouping = levelUpFromSerie;
      }
      else if (levelDownToSerie) {
        currentLevel --;
        settings = settingLevels[currentLevel]; 
      }  
      updateRanges();
    
      var enlargeInterval = (from != null && to != null);
      if (from == null) from = timeFrom;
      if (to == null) to = timeTo;
      
      var dateFrom = settings.dateFormat(new Date(from));
      var dateTo =   settings.dateFormat(new Date(to));
      var query =    settings.query(dateFrom, dateTo, settings.grouping);
     
      console.log ("AJAX Query: "+query);
      d3.json(query, function(data) {
          
        var table = data[settings.tableName];
        var newSeries = new Object();
        for (var i=0; i<table.length; i++) {
          var key = table[i][settings.serieKey];
          if (!series[key]) {
            series[key] = new Array();
            series[key].level = currentLevel;
            console.log ("Serie added:"+key);

          }
            
          var date = settings.dateFormat.parse( table[i][settings.dateKey] ).getTime();
          var value = table[i][settings.valueKey];
          
          var foundExisting = false;
          for (d in series[key]) 
            if (series[key][d].date == date) {
              series[key][d].value = value;
              foundExisting = true;
              break;
            }
          if (!foundExisting)
            series[key].push( { "date" : date, "value": value } );
        }
         
        for ( s in series ) {
          series[s].sort(function(a,b) { return a.date - b.date; } );
          if (!series[s].path) {

            series[s].path = clippedArea.append("svg:path")
                                .attr("d", line(series[levelUpFromSerie ? levelUpFromSerie : s]))
                                .style("stroke", d3.rgb(255,255,255).toString());
                           
            series[s].color = d3.hsl(Math.random()*360, 1, 0.5).toString();            
            //adding mouseover and mouseout events
            series[s].path.on("mouseover", function() {
                var coords = d3.mouse(this);
                var timex = scalesTime.invert(coords[0]);
                var valuey = scalesValue.invert(coords[1]);
                var datex = settings.dateFormat(timex);
                
                for ( ss in series ) 
                  if (series[ss].path.node() == this)
                     svgInfo.text(ss+" ("+datex+": "+valuey+")");
                d3.select(this).classed("mouseover", true);
            }).on("mouseout", function() {
                svgInfo.text("");
                d3.select(this).classed("mouseover", false);
            });
            
            series[s].path.on("click", function() {
            
              if (currentLevel > 0)
                loadDataAndRedraw(null,null,null,settings.grouping);
              else {
                var clickedSerie = null;
                for ( ss in series ) 
                  if (series[ss].path.node() == this) 
                    clickedSerie = ss;
                    
                
                if (clickedSerie) {
                  series[clickedSerie].path.classed("clicked", true);
                  console.log ("Clicked serie: "+clickedSerie);

                  loadDataAndRedraw(null,null,clickedSerie);
                }
              }
                           
            });
            
          }
          if (enlargeInterval)
            series[s].path.attr("d", line(series[s]));
        }   
          
        redraw();
      });
    }
    
    function redraw() {

      scalesTime = getTimeScale();
      console.log ("Redraw: "+timeFrom+"-"+timeTo+ "  - level:" + currentLevel+" gr:"+ settings.grouping);
      for ( s in series ) 
        if (series[s].level == currentLevel)
          series[s].path.classed("clicked", false).transition()
            .duration(speed)
            .attr("d", line(series[s]))
            .style("stroke", series[s].color );
        else if (series[s].level < currentLevel)
          series[s].path.transition()
            .duration(speed)
            .attr("d", line(series[s]))
            .style("stroke", d3.rgb(240,240,240).toString());   
        else if (series[s].level > currentLevel) {
          series[s].path.transition()
            .duration(speed)
            .attr("d", line(series[settingLevels[currentLevel+1].grouping]))
            .remove();
            
          delete series[s];
        }
      //svgYaxis.call(yAxis);
      //svgYaxisBackground.call(yAxisBackground);
      
      /*xAxis.scale(scalesTime)
        .ticks(d3.time.years, 1)
        .tickSubdivide(1);
      yAxis.scale(scalesValue) 
        .ticks(5)
        .tickSubdivide(1);*/
        
      xAxis.scale(scalesTime)
        .ticks(settings.timeAxis.unit, settings.timeAxis.unitStep)
        .tickSubdivide(settings.timeAxis.subdivide);
      yAxis.scale(scalesValue) 
        .ticks(settings.valueAxis.tickCount)
        .tickSubdivide(settings.valueAxis.subdivide);
      
      //xAxisBackground.scale(scalesTime);
      svgXaxis.transition().duration(speed).call(xAxis);
      svgYaxis.transition().duration(speed).call(yAxis);
      //svgXaxisBackground.transition().duration(speed).call(xAxisBackground);
      
      chartTitle.text(settings.title);
      chartDescription.text(settings.description);
    }
    ///////////////////////////////////////////////
    
    
    buttonContainer.select(".reload").on("click", function() { 
      alert("Reloading...");
      loadDataAndRedraw();
    });
    
    buttonContainer.select(".fromplus").on("click", function() { 
      timeFrom += 1000*60*60*24*30;
      redraw();
    });
    
    buttonContainer.select(".fromminus").on("click", function() { 
      var old = timeFrom;
      timeFrom -= 1000*60*60*24*30;
      loadDataAndRedraw(timeFrom, old);
    });
    
    buttonContainer.select(".toplus").on("click", function() { 
      var old = timeTo;
      timeTo += 1000*60*60*24*30;
      loadDataAndRedraw(old, timeTo);
    });
    
    buttonContainer.select(".tominus").on("click", function() { 
      timeTo -= 1000*60*60*24*30;
      redraw();
    });
       
    ///////////////////////////////
    //
    // INIT
    //
    ///////////////////////////////
  
 
    //svg init
    var svg = d3.select(this).append("svg:svg")
      .attr("width", totalWidth)
      .attr("height",totalHeight);
      //.style("background-color","#fafafa");
    
    var line = d3.svg.line()
      .x(function(dataRecord) { return margin + scalesTime(dataRecord["date"]); })
      .y(function(dataRecord) { return margin + scalesValue(dataRecord["value"]);});  

       
    ////////////////
    
    svg.append("rect")
      .attr("class", "chartBackground")
      .attr("width", width + "px")
      .attr("height", height + "px")
      .attr("x", margin + "px")
      .attr("y", margin + "px");
      
      
    var clipRect = svg.append("svg:clipPath")
        .attr("id", "clipRect")
        .append("svg:rect")
        .attr("width", width + "px")
        .attr("height", height + "px")
        .attr("x", margin + "px")
        .attr("y", margin + "px");

        
    var clippedArea = svg.append("g")
        .attr("clip-path", "url(#clipRect)");
      
    /*var svgXaxisBackground = svg.append("g")
      .attr("class", "xaxisBackground axisBackground")
      .attr("transform", "translate("+margin+"," + (totalHeight-margin) + ")");

    var svgYaxisBackground = svg.append("g")
      .attr("class", "yaxisBackground axisBackground")
      .attr("transform", "translate("+margin+","+ margin+")");
    */  
    
    var svgXaxis = svg.append("g")
      .attr("class", "xaxis axis")
      .attr("transform", "translate("+margin+"," + margin + ")");

    var svgYaxis = svg.append("g")
      .attr("class", "yaxis axis")
      .attr("transform", "translate("+(width + margin)+","+ margin +")");
    

    /*var svgTitle = svg.append("text")
      .attr("transform", "translate(" + width + ",0)")

      //.attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text(settings.title);*/
      
      
     var svgInfo = svg.append("text")
      .attr("transform", "translate(" + (width + margin) + ",0)")

      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("");

    ///////////////////////////
    
    loadDataAndRedraw();

  });
    
  return this; //for method chaining
}
  
  
  

