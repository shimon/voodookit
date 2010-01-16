/**

   Voodookit plugin for jQuery.
   Copyright (c) 2009 Shimon Rura, shimon@rura.org.
   
   Dual licensed under the MIT and GPL licenses, just like jQuery:
   http://docs.jquery.com/License

 **/

(function($) {
    
    var ENABLE_LOGGING = true;

    var log = function(txt) {
        if(ENABLE_LOGGING && window.console) {
            console.log(txt);
        }
    };

    /* Prerequisite: add UTC handling to Date object */
    Date.prototype.getUTCTime = function() {
        return this.getTime() - this.getTimezoneOffset()*60*1000;
    };

    /**
       Given a UTC epoch-ms time, create a Date object whose getUTCTime()
       method returns the utc_epoch_ms value.
     */
    Date.fromUTCTime = function(utc_epoch_ms) {
        var d = new Date(utc_epoch_ms);
        var dptr = new Date(d.getTime() - d.getTimezoneOffset()*60*1000);

        var dptr_distance = utc_epoch_ms - dptr.getUTCTime();
        var incr = 0;
        var last_incr = 0;

        var stepsize = dptr_distance;

        var num_attempts = 0;

        while(dptr_distance != 0 && num_attempts < 100) {
            incr = (dptr_distance < 0) ? -1 : 1;

            if(incr != last_incr) {
                stepsize = Math.max(1, Math.round(stepsize/2));
            }

            last_incr = incr;

            dptr = new Date(dptr.getTime() + incr*stepsize);
            dptr_distance = utc_epoch_ms - dptr.getUTCTime();

            num_attempts++;
            //log(num_attempts + ". trying date: " + dptr.toString() + ", dist="+dptr_distance+", step="+incr*stepsize);
        }

        return dptr;
    };





    /** 
        VkCell class
    **/
    function VkCell(vkTable, $td, columnIndex, vkRow) {
        this.vkTable = vkTable;
        this.$td = $td;
        this.columnIndex = columnIndex;
        this.vkRow = vkRow;

        this.isEmpty = false;

        var c = this.col();
        if(c.is_computed()) {
            this.recomputeValue(c, true);
            // wire up listeners
            var r = this.row();
            var me = this;
            var recompute_me = function() { me.recomputeValue(); };
            for(var i = 0; i < c.compute_from_cols.length; i++) {
                r.cell(c.compute_from_cols[i]).$td.bind("vkChange",recompute_me);
            }
        } else {
            this.parseToValue(c.coltype.extractValue($td), true);
        }
    }

    VkCell.prototype.recomputeValue = function(c, inhibitChangeEvent) {
        if(!c) { c = this.col(); }

        var compute_params = Array(c.compute_from_cols.length);

        for(var i = 0; i < c.compute_from_cols.length; i++) {
            compute_params[i] = this.row().cell(c.compute_from_cols[i]).value();
        }
        
        return this.value(c.compute_function.apply(this, compute_params), inhibitChangeEvent);
    };

    VkCell.prototype.row = function() {
        return this.vkRow;
    };

    VkCell.prototype.value = function(newValue, inhibitChangeEvent) {
        //log("VkCell.prototype.value; typeof newValue="+(typeof newValue));

        if(typeof newValue != "undefined") {
            if(this.isEmpty || this._value != newValue) {
                this.isEmpty = false;
                var oldValue = this._value;
                this._value= newValue;

                if(!inhibitChangeEvent) {
                    this.sendChangeEvent(oldValue);
                }
            }
        }
        return this._value;
    };

    VkCell.prototype.sendChangeEvent = function(oldValue) {
        if(oldValue === this.value()) {
            log("Filtered non-change change event.");
            return;
        }

        var evtParams = {
            "oldValue": oldValue,
            "cell": this
        };
        this.$td.trigger("vkChange", evtParams);
        this.col().trigger("vkChange", evtParams);
    };
    
    VkCell.prototype.parseToValue = function(valuestring, inhibitChangeEvent) {
        var oldValue = this._value;

        if(valuestring == "") {
            this._value = this.colType().emptyValue();
            this.isEmpty = true;
        } else {
            var newvalue = this.colType().parseValue(valuestring);
            if(newvalue != null) {
                this._value = newvalue;
                this.isEmpty = false;
            }
        }

        if(!inhibitChangeEvent) {
            this.sendChangeEvent(oldValue);
        }
    };

    VkCell.prototype.toString = function() {
        return ""+this.value();
    };

    VkCell.prototype.col = function() {
        return this.vkTable.col(this.columnIndex);
    };

    VkCell.prototype.colType = function() {
        return this.col().coltype;
    };

    VkCell.prototype.as_json = function() {
        return this.isEmpty? "null": '"' + this._value.toString().replace(/"/g,'\\"') + '"'; //");
    };



    /** 
        VkColumn class
    **/
    function VkColumn(vkTable, index, coltype, renderer, name, compute_from_cols, compute_function) {
        this.vkTable = vkTable;
        this.index = index;
        this.coltype = coltype;
        this.render = renderer;
        this.name = name;
        this.compute_from_cols = compute_from_cols;
        this.compute_function = compute_function;

        this._eventStub = $("<div class='vkColumn event stub'>");
        this._eventStub.data("vkColumn", this);
    };

    VkColumn.DELEGATE_TO_EVENT_STUB = ["trigger", "bind", "one", "triggerHandler"];
    
    for(var i = 0; i < VkColumn.DELEGATE_TO_EVENT_STUB.length; i++) {

        (function(funcname){

            VkColumn.prototype[funcname] = function() {
                var args = Array.prototype.slice.call(arguments);

                //log("col [name="+this.name+"] called "+funcname+", args="+args.join(","));

                this._eventStub[funcname].apply(this._eventStub, args);
            };
            
        })(VkColumn.DELEGATE_TO_EVENT_STUB[i]);

    }

    VkColumn.prototype.is_computed = function() {
        return typeof this.compute_function == "function";
    };


    VkColumn.prototype.cells = function() {
        return $.map( this.vkTable.$table.find("tr td:nth-child("+(this.index+1)+")"),
                      function(e) { return $(e).data("vkCell"); } );
    };

    VkColumn.prototype.cellValues = function() {
        return $.map( this.cells(), function(c) { return c.value(); } );
    };

    VkColumn.prototype.cell = function(rowNum) {
        return this.vkTable.$table.find("tr:has(td):eq("+rowNum+") td:nth-child("+(this.index+1)+")").data("vkCell");
    };

    

    VkColumn.prototype.reduce = function( reductor, initial ) {
        var result;

        var values = this.cellValues();

        if(values.length >= 1) {
            if(typeof initial != "undefined") {
                result = reductor(initial, values[0]);
            } else {
                result = values[0];
            }
        } else if(typeof initial != "undefined") {
            result = initial;
        }

        for(var i = 1; i < values.length; i++) {
            result = reductor(result, values[i]);
        }

        return result;
    };

    VkColumn.sum = function(x,y) { if(!x) x=0; if(!y) y=0; return x+y; };

    VkColumn.prototype.sum = function() {
        return this.reduce(VkColumn.sum, 0);
    };

    VkColumn.prototype.grep = function( test ) {
        var result = [];
        var cells = this.cells();

        for(var i = 0; i < cells.length; i++) {
            if(test(cells[i])) {
                result.push(cells[i]);
            }
        }

        return result;
    };

    VkColumn.prototype.sort = function( in_reverse, force_blanks_last ) {
        return this.vkTable.sort([ (in_reverse?"-":"")+(this.name||this.index) ], force_blanks_last);
    };

    VkColumn.prototype.sortReverse = function() {
        return this.sort(true);
    };

    VkColumn.prototype.sortReverseBlanksLast = function() {
        return this.sort(true,true);
    };




    /** 
        VkRow class
    **/
    function VkRow(vkTable, $tr) {
        this.vkTable = vkTable;
        this.$tr = $tr;
    };

    VkRow.prototype.cell = function(colId) {
        return this.raw_cell(colId).data("vkCell");
    };

    VkRow.prototype.raw_cell = function(colId) {
        var col = this.vkTable.col(colId);
        if(!col) {
            log("Error: unknown column ID '"+colId+"'.");
        } else {
            return this.$tr.find("td:eq("+col.index+")");
        }
    };

    VkRow.prototype.cells = function() {
        return this.$tr.find("td").map(function() { 
                return $(this).data("vkCell"); 
            });
    };

    VkRow.prototype.prepDelete = function() {
        return this.deleterow(true);
    };

    VkRow.prototype.deleterow = function(dontRemove) {
        var result = this.$tr;

        result.trigger("vkRowDelete");// Should be PreDelete

        this.vkTable.$contentRows().not(result).each(function(i) {
                $(this).trigger("vkRowScan", {
                        "rowIndex": i,
                        "vkRow": $(this).data("vkRow")
                    });
            });

        if(!dontRemove) { result.remove(); }
        // Should now trigger PostDelete

        return result;
    };
    
    VkRow.prototype.as_json = function() {
        return "[" + this.cells().map(function() { return this.as_json(); }).get().join(",") + "]";
    };


    /** 
        VkTable class
    **/
    function VkTable(table, options) {
        this.table = table;
        this.$table = $(table);
        
        // Vk state
        // <table>: $(table).data("voodookit")
        // <tr>: .data("vkRow")
        // <td>: .data("vkCell")
        // <th>: .data("vkHeaderCell")

        this.columns = [];
        this.column_name_map = {};

        if(options["cols"]) {
            for(var i = 0; i < options["cols"].length; i++) {

                var colopts = { 
                        "type": $.voodoo.types.string,
                        "render": new $.voodoo.render.NullRender(),
                        "name": null,
                        "compute_from_cols": null,
                        "compute_function": null
                };

                $.extend(colopts, options["cols"][i] || {})

                var coltype = colopts["type"];
                var render = colopts["render"];
                var name = colopts["name"];
                var compute_from_cols = colopts["compute_from_cols"];
                var compute_function = colopts["compute_function"];

                this.columns.push(new VkColumn(this, i, coltype, render, name, compute_from_cols, compute_function));
                if(name) {
                    this.column_name_map[name] = i;
                }

            }
        }

        this.findNewRows(false);
    };

    VkTable.prototype.findNewRows = function(generateRowAppendEvents) {
        var thisvkt = this;

        var newrows = [];

        this.$table.find("tr:has(td)").each(function(contentRowIndex) {
                var $thistr = $(this);
                if($thistr.data("vkRow")) { 
                     // skip any already-handled rows
                    log("skipping row #"+contentRowIndex); 
                    return; 
                }

                $thistr.contentRowIndex = contentRowIndex;
                newrows.push($thistr);

                var thisVkRow = new VkRow(thisvkt, $thistr);
                $thistr.data("vkRow", thisVkRow);

                var cells = [];

                $thistr.find("td").each(function(columnIndex) {

                        var thisCol;
                        
                        if(columnIndex >= thisvkt.columns.length) {
                            // no column data for this? use the defaults
                            thisCol = new VkColumn(thisvkt, 
                                                   columnIndex, 
                                                   $.voodoo.types.string, 
                                                   new $.voodoo.render.NullRender());
                            thisvkt.columns.push( thisCol );
                        } else {
                            thisCol = thisvkt.columns[columnIndex];
                        }

                        var $td = $(this);

                        if(thisCol.name) {
                            $td.addClass(thisCol.name);
                        }

                        var vkc = new VkCell(thisvkt, $td, columnIndex, thisVkRow);
                        $td.data("vkCell", vkc);

                        cells.push(vkc);
                    });


                if(generateRowAppendEvents) {
                    $thistr.trigger("vkRowAppend");
                }

            });

        // after VkCells have been created, render their values
        for(var i = 0; i < newrows.length; i++) {
            var $thistr = newrows[i];

            $thistr.find("td").each(function(columnIndex) {
                    var ren = thisvkt.columns[columnIndex].render;
                    var vkc = $(this).data("vkCell");
                    ren.renderCell(vkc);
                    ren.listenTo(vkc);
                });

            //log("triggering vkRowScan for row #"+ contentRowIndex);
            $thistr.trigger("vkRowScan", { 
                    "rowIndex": $thistr.contentRowIndex,
                    "vkRow": $thistr.data("vkRow")
                });
        }
    };

    VkTable.prototype.numRows = function() {
        return this.$table.find("tr").size();
    };

    VkTable.prototype.numCols = function() {
        return this.$table.find("tr:has(td):first td").size();
    };

    VkTable.prototype.numContentRows = function() {
        return this.$table.find("tr:has(td)").size();
    };

    VkTable.prototype.numHeaderRows = function() {
        return this.numRows() - this.numContentRows();
    };

    VkTable.prototype.$contentRows = function() {
        return this.$table.find("tr:has(td)");
    };

    VkTable.prototype.rows = function() {
        return this.$table.find("tr:has(td)").map(function() { 
                return $(this).data("vkRow");
            });
    };


    VkTable.prototype.cell = function(row,col) {
        return this.$table.find("tr:has(td):eq("+row+") td:eq("+col+")").data("vkCell");
    };

    VkTable.prototype.row = function(rownum) {
        return this.$table.find("tr:has(td):eq("+rownum+")").data("vkRow");
    };

    VkTable.prototype.col = function(indexOrName) {
        var index;

        if(typeof indexOrName == "string") {
            index = this.column_name_map[indexOrName];

            if(index == null) {
                try {
                    index = parseInt(indexOrName);
                } catch(e) {
                    alert("Could not find column matching name/index "+indexOrName);
                }
            }
        } else {
            index = indexOrName;
        }
        
        return this.columns[index];
    };

    VkTable.prototype.makeHeadersSort = function() {
        var thisvkt = this;

        var $headers = this.$table.find("tr:first th");

        var ordr = VkTable.prototype.makeHeadersSort.currentOrder;

        $headers.each(function(i) { 
                $(this).unbind("click").bind("click", function() { 
                        var stri = i+"";
                        var striRev = "-"+stri;

                        var newOrder = stri;
                        if(ordr.length && ordr[0] == stri) {
                            newOrder = striRev;
                        }
                        
                        // remove from existing order
                        ordr = $.grep(ordr, function(c) { return c != stri && c!= striRev });
                        ordr.unshift(newOrder);

                        //log("ORDER: "+ordr.join(", "));

                        thisvkt.sort(ordr, true);
                        //alert("SORTING column "+$(this).text());
                        //thisvkt.col(i).sort();
                    });
            });

        return $headers;
    };

    VkTable.prototype.makeHeadersSort.currentOrder = [];

    VkTable.prototype.append = function() {
        var args = Array.prototype.slice.call(arguments);
        var result = this.$table.append.apply(this.$table, args);
        this.findNewRows(true);

        return this;
    };

    VkTable.prototype.appendRow = function(param) {
        if(typeof param == "undefined") {
            param = this.columns.length;
        }

        var ordered_values = [];

        if(typeof param == "number") {
            ordered_values = Array(param);

        } else if(typeof param == "object") {
            
            if(param.constructor == Array) { // ordered values
                ordered_values = param;

            } else { // object/hash
                ordered_values = Array(this.columns.length);

                for(var i = 0; i < this.columns.length; i++) {
                    var col = this.columns[i];

                    if(i in param) {
                        ordered_values[i] = param[i];
                    }

                    if(col.name && col.name in param) {
                        ordered_values[i] = param[col.name];
                    }
                }
            }

        }

        var $newtr = $("<tr>");
        for(var i = 0; i < ordered_values.length; i++) {
            var $newtd = $("<td>");
            $newtd.text(ordered_values[i] || "");
            $newtr.append($newtd);
        }

        this.append($newtr);
        return $newtr;
    };

    VkTable.prototype.loadRowsFromTable = function($newtbl) {
        this.append($newtbl.find("tr:has(td)").clone());
        return this;
    };

    VkTable.prototype.clear = function() {
        this.$contentRows().remove();
    };

    VkTable.prototype.loadRowsFromUrl = function(url, data, callback) {
        var $loadcontainer = $("<div>");
        var thisvkt = this;

        var mycallback = function(data, textStatus) {
            if(callback) {
                callback.call(this, data, textStatus);
            }

            thisvkt.loadRowsFromTable($loadcontainer.find("table:eq(0)"));
        };

        $loadcontainer.load(url, data, mycallback);

        return this;
    };


    VkTable.prototype.altRender = function(format) {
        if(!format) { format = "json"; }

        var methodname = "as_"+format;

        if(typeof this[methodname] == "function") {
            return this[methodname]();
        } else {
            // TODO: throw an exception
            return "Unknown altRender format: "+format;
        }
    };

    VkTable.prototype.as_json = function() {
        return "[" + this.rows().map(function() { return this.as_json(); }).get().join(",\n ") + "]";
    };


    VkTable.prototype.sort = function(sortColNames, force_blanks_last) {
        if(sortColNames.length < 1) { return; } // no sort order specified

        var sortCols = new Array(sortColNames.length);
        var sortInReverse = new Array(sortColNames.length);
        var i;

        for(i = 0; i < sortColNames.length; i++) {
            var colname = sortColNames[i] + "";
            var isReversed = false;
            if(colname.charAt(0) == "-") {
                isReversed = true;
                colname = colname.toString().substring(1);
            }

            sortCols[i] = this.col(colname);
            sortInReverse[i] = isReversed;
        }

        var allSortSeqClasses = $.map(this.columns, function(x) { return "sort_"+x.index }).join(" ") + " sort_asc sort_desc";

        this.$table.find("tr:first th").each(function(i) {

                var sortSeqNum = null;
                var sortRev = false;
                
                for(var j = 0; j < sortCols.length; j++) {
                    if(sortCols[j].index == i) {
                        sortSeqNum = j;
                        sortRev = sortInReverse[j];
                    }
                }

                $(this).removeClass(allSortSeqClasses);
                if(sortSeqNum == null) { return; }
                $(this).addClass("sort_"+sortSeqNum+" "+(sortRev? "sort_desc":"sort_asc"));
            });

        

        var allrows = this.$contentRows();


        var comparator = function(a,b) {
            var cell_a;
            var cell_b;
            var curr_col_index;

            for(i = 0; i < sortCols.length; i++) {
                curr_col_index = sortCols[i].index;

                cell_a = $(a).find("td:eq("+curr_col_index+")").data("vkCell");
                cell_b = $(b).find("td:eq("+curr_col_index+")").data("vkCell");

                if(cell_a.isEmpty) {
                    if(cell_b.isEmpty) {
                        continue; // next column; was //return 0;
                    } else {
                        // a is empty; b isn't, so a<b unless force_blanks_last
                        if(sortInReverse[i] || force_blanks_last) {
                            return 1;
                        } else {
                            return -1;
                        }
                    }
                } else if(cell_b.isEmpty) {
                    // a is nonempty; b is empty, so b>a if force_blanks_last
                    if(sortInReverse[i] || force_blanks_last) {
                        return -1;
                    } else {
                        return 1
                    }
                }

                if(sortInReverse[i]) {
                    var tmp = cell_a;
                    cell_a = cell_b;
                    cell_b = tmp;
                }

                var val_a = (cell_a.value() || 0).valueOf();
                var val_b = (cell_b.value() || 0).valueOf();

                if(val_a < val_b) {
                    return -1;
                } else if(val_b < val_a) {
                    return 1;
                } else {
                    continue; // return 0;
                }
            }

            // if we completed the for loop, that means we looked
            // at all columns and they were all equal...
            return 0;
        };

        allrows.sort(comparator);

        for(var i = 0; i < allrows.length; i++) {
            this.$table.append(allrows[i]);
            $(allrows[i]).trigger("vkRowScan", { 
                    "rowIndex": i,
                    "vkRow": $(allrows[i]).data("vkRow")
            });
        }

        this.$table.trigger("vkRowsReordered");
    };


    /**
       Main public interface -- $("selection").voodoo(...)
     **/
    $.fn.voodoo = function(options) {

        var result = [];
        
        this.each(function(i) {
                var $this = $(this);

                if($this.is("table")) {

                    if(!$this.data("voodookit")) {
                        $this.data("voodookit", new VkTable(this, options || {}));
                    }
                    
                    result.push($this.data("voodookit"));

                } else if($this.is("tr")) {
                    result.push($this.data("vkRow"));

                } else if($this.is("td")) {
                    result.push($this.data("vkCell"));

                } else if($this.is("div.vkColumn.event.stub")) {
                    result.push($this.data("vkColumn"));

                }
            });

        if(result.length == 1) {
            return result[0];
        } else {
            return result;
        }
    };


    /// Types: these objects determine how a value is deserialized,
    /// converted to a javascript object, and later re-serialized on its way
    /// up to the server.

    var typeCls = {};

    typeCls.BaseType = function() {};
    typeCls.BaseType.prototype = {
        emptyValue: function() { return ""; },
        parseValue: function(s) { return s; },
        extractValue: function($td) { return $td.html(); }
    };

    typeCls.String = function() {};
    typeCls.String.prototype = new typeCls.BaseType();

    typeCls.HtmlEscapedString = function() {};
    typeCls.HtmlEscapedString.prototype = new typeCls.BaseType();
    typeCls.HtmlEscapedString.prototype.extractValue = function($td) { return $td.text(); }

    typeCls.Integer = function(base) {
        if(base) { this.base = base; }
        else { this.base = 10; }
    };
    typeCls.Integer.prototype = new typeCls.BaseType();
    typeCls.Integer.prototype.parseValue = function(s) { 
        var r = parseInt(s, this.base); 
        return isNaN(r)? null : r;
    };

    typeCls.Float = function() {};
    typeCls.Float.prototype = new typeCls.BaseType();
    typeCls.Float.prototype.parseValue = function(s) { 
        var r = parseFloat(s);
        return isNaN(r)? null : r;
    };

    typeCls.Boolean = function() {};
    typeCls.Boolean.prototype = new typeCls.BaseType();
    typeCls.Boolean.prototype.parseValue = function(s) { 
        if(s == "0" || s=="false" || s=="False") {
            return false;
        }
        return !!s;
    };

    typeCls.DateTime = function() {};
    typeCls.DateTime.prototype = new typeCls.BaseType();
    typeCls.DateTime.prototype.emptyValue = function() {
        return null;
    };
    typeCls.DateTime.prototype.parseValue = function(s) { 
        var floatval = parseFloat(s);
        if(isNaN(floatval)) { return null; }
        //return new Date(floatval); 
        return Date.fromUTCTime(floatval); 
    };
    
    typeCls.Date = function() {};
    typeCls.Date.prototype = new typeCls.DateTime();

    $.voodoo = {};
    $.voodoo.basetypes = typeCls;
    $.voodoo.types = {};

    // Make singletons available to the public, under firstLowerCase names
    for(var typename in typeCls) {
        $.voodoo.types[typename.substring(0,1).toLowerCase() + typename.substring(1)] = new typeCls[typename]();
    }


    ////////////////////////////// RENDERERS ////////////////////////////////

    // Renderers: These objects determine how a javascript value is rendered
    // into HTML for display to the user.
    var renderCls = $.voodoo.render = {};

    renderCls.Base = function(_opts) { this.init(_opts); };
    renderCls.Base.prototype.init = function(_opts) {
        var opts = {
            "default": ""
        };

        $.extend(opts, _opts || {});

        this.defaultResult = opts["default"];

        if("defaultValue" in opts) {
            this.useDefaultValue = true;
            this.defaultValue = opts["defaultValue"];
        } else {
            this.useDefaultValue = false;
        }

        this.opts = opts;

        return opts;
    };

    renderCls.Base.prototype.renderCell = function(vkc) {
        var val;
        if(vkc.isEmpty) {
            if(!this.useDefaultValue) {
                vkc.$td.html( this.defaultResult );
                return;
            } else {
                val = this.defaultValue;
            }
        } else {
            val = vkc.value();
        }

        this.renderValueToCell(vkc, val);
    };

    renderCls.Base.prototype.getChangeListener = function() {
        if(!this._changeListener) {
            var thisrenderer = this;
            this._changeListener = function(e, data) { thisrenderer.renderCell(data["cell"]); };
        }

        return this._changeListener;
    };

    renderCls.Base.prototype.listenTo = function(vkc) { 
        vkc.$td.bind("vkChange", this.getChangeListener());
    };

    // OVERRIDE ME!
    renderCls.Base.prototype.renderValueToCell = function(vkc, val) {
        if(val != null) {
            vkc.$td.html( val.toString() );
        }
    };

    /* Null Renderer: do absolutely nothing. */
    renderCls.NullRender = function() { };
    renderCls.NullRender.prototype.renderCell = function() { };
    renderCls.NullRender.prototype.listenTo = function() { };


    // a Rendererer Factory - some shortcuts for making custom renderers.
    $.voodoo.makeRen = {};

    // given a custom renderValueToCell function, and optional parent
    // (default is $.voodoo.render.Base), return a renderer class.
    $.voodoo.makeRen.simpleClass = function(rvtcFunc, parentClass) {
        var myRen = function(_opts) { this.init(_opts); };
        if(typeof parentClass == "undefined") {
            parentClass = $.voodoo.render.Base;
        }
        myRen.prototype = new parentClass();
        myRen.prototype.renderValueToCell = rvtcFunc;

        return myRen;
    };

    // Like the simpleClass function, except that it returns an instance of
    // the class rather than the class itself.  Useful if you want a terse
    // way to list a custom renderer in your initial $(table).voodoo() call.
    $.voodoo.makeRen.simple = function(rvtcFunc, parentClass) {
        var rcls = $.voodoo.makeRen.simpleClass(rvtcFunc, parentClass);
        return new rcls();
    };



    // Templating!
    function _htmlescape(str) {
        return $('<div/>').text(str).html();
    }

    // split template string into an array of tokens.
    function _templateTokenize(templateStr) {
        var result = [];
        var cursor = 0;
        var start,end;

        while(cursor < templateStr.length) {
            start = templateStr.indexOf("<<",cursor);

            if(start < 0) { // no match; rest of templateStr is one boring token
                result.push(templateStr.substring(cursor));
                cursor = templateStr.length;

            } else if(start != cursor) { // cursor prefixed by boring token
                result.push(templateStr.substring(cursor, start));
                cursor = start;

            } else { // aha! we begin with an interesting token
                end = templateStr.indexOf(">>",cursor+2);
                if(end < 0) { // start with no end - syntax error
                    alert("Syntax error: expected >> in templateStr: " + templateStr);
                    return result;
                }
                result.push(templateStr.substring(cursor, end+2));
                cursor = end + 2;
            }
        }

        //alert("tokenized: {" + result.join("}\n{") + "}");
        //return ["<<if notescount>>", "<<notescount>>", "<</if>>"];
        return result;
    };

    $.voodoo.vkTrue = function(value) {
        return(value != null && value != "" && value != 0 && value != "0");
    };


    $.voodoo.makeRen.compileTemplate = function(templateStr) {
        /*
        return function(vkc) {
            vkc.$td.text(templateStr);
        };
        */
        
        var tokens = _templateTokenize(templateStr);
        var openBraceCount = 0;
        var generatedFunc = "var templateCompiled = function(vkc) { var row = vkc.row(); var result = ''; ";

        for(var i in tokens) {
            var token = tokens[i];

            if(token.match(/^<<if\s+(.*)>>$/)) {

                generatedFunc += "if(";

                var vbles = RegExp.$1.split(/\s+or\s+/);

                for(var i = 0; i < vbles.length; i++) {
                    vbles[i] = "jQuery.voodoo.vkTrue(row.cell('" + vbles[i] + "').value())";
                }
                
                generatedFunc += vbles.join(" || ") + ") { ";

                openBraceCount++;

            } else if(token == "<<else>>") {
                generatedFunc += "} else { ";

            } else if(token == "<</if>>") {
                generatedFunc += "} ";
                openBraceCount--;

            } else if(token.match(/^<<([^|>]+)|escape>>$/)) {
                generatedFunc += "result += _htmlescape(row.cell('" + RegExp.$1 + "').value()); ";
            } else if(token.match(/^<<([^|>]+)>>$/)) {
                generatedFunc += "result += row.cell('" + RegExp.$1 + "').value(); ";
            } else {
                generatedFunc += "result+= '" + token.replace(/'/g,"\\'") + "'; "; //');
            }
        }

        generatedFunc += "vkc.$td.html(result); };";

        if(openBraceCount != 0) {
            alert("Voodookit Template error: unmatched <<if>> and <</if>> statements in template: " + templateStr);
            return function() { return "{Template Error}"; };
        }

        eval(generatedFunc); // puts function into local var templateCompiled

        return templateCompiled;

    };


    $.voodoo.makeRen.template = function(templateStr) {
        var myRen = function(_opts) { this.init(_opts); };
        myRen.prototype = new $.voodoo.render.Base();
        myRen.prototype.renderCell = $.voodoo.makeRen.compileTemplate(templateStr);

        return new myRen();
    };



    //////////////////////// MORE RENDERERS ////////////////////////////////


    // String - same as Base, but uses .text() instead of .html()
    renderCls.String = $.voodoo.makeRen.simpleClass(function(vkc, val) {
            vkc.$td.text( val );
        });

    // HtmlString - same as Base
    renderCls.HtmlString = renderCls.Base;

    // LocaleDate - for Date objects
    renderCls.LocaleDate = $.voodoo.makeRen.simpleClass(function(vkc, val) {
            vkc.$td.text(val? val.toLocaleDateString() : "");
        });

                                               
    // LocaleDateTime - for Date objects
    renderCls.LocaleDateTime  = $.voodoo.makeRen.simpleClass(function(vkc, val) {
            vkc.$td.text(val? val.toLocaleString() : "");
        });


    // TextField - editable <input type=text>
    renderCls.TextField = function(_opts) { this.init(_opts); };
    renderCls.TextField.prototype = new renderCls.Base();
    renderCls.TextField.prototype.renderCell = function(vkc) {
        var $input = vkc.$td.find("input[type='text']");
        if(!$input.length) {
            $input = $("<input type='text'>");
            vkc.$td.empty().append($input);

            if(this.opts.autocomplete && $input.autocomplete) {
                $input.autocomplete(this.opts.autocomplete);

                $input.bind("result", function(e) {
                        // throw away any waiting updates
                        var timerId = $input.data("delayedUpdate");
                        if(timerId) {
                            clearTimeout(timerId);
                        }

                        vkc.parseToValue($input.val());
                    });

                $input.bind("change", function(e) { 
                        if($(".ac_results:visible").length) {

                            var timerId = $input.data("delayedUpdate");
                            if(timerId) {
                                clearTimeout(timerId);
                            }

                            timerId = setTimeout(function() {
                                    $input.data("delayedUpdate", null);
                                    vkc.parseToValue($input.val());
                                }, 2000);
                            $input.data("delayedUpdate", timerId);
                        } else {
                            vkc.parseToValue($input.val());
                        }
                    });
                
            } else {
                // if not using autocomplete, no need for timer hack
                $input.bind("change", function(e) { vkc.parseToValue($input.val());});
            }
        }

        $input.val(vkc.value());
    };

    // CheckboxField - editable <input type=checkbox>
    renderCls.CheckboxField = function(_opts) { 
        var opts = this.init(_opts); 

        if(typeof opts.boolToValue == "function") {
            this.boolToValue = opts.boolToValue;
        } else {
            this.boolToValue = null;
        }
    };
    renderCls.CheckboxField.prototype = new renderCls.Base();

    renderCls.CheckboxField.prototype.renderCell = function(vkc) {
        var val = vkc.value();
        var thisRenderer = this;

        var $input = $("<input type='checkbox'>");
        $input.val(val);
        $input.attr("checked", !!val);

        $input.bind("change", function(e) { 
                if(thisRenderer.boolToValue) {
                    vkc.value(thisRenderer.boolToValue(!!$input.attr("checked")));
                } else {
                    vkc.parseToValue(!!$input.attr("checked"));
                }

            });

        vkc.$td.empty().append($input);
    };

    // Hidden - hides this cell altogether
    renderCls.Hidden = function(_opts) { this.init(_opts); };
    renderCls.Hidden.prototype = new renderCls.Base();
    renderCls.Hidden.prototype.renderCell = function(vkc) {
        vkc.$td.hide();
    };


    // access to internal classes
    $.voodoo.VkTable = VkTable;
    $.voodoo.VkColumn = VkColumn;
    $.voodoo.VkRow = VkRow;
    $.voodoo.VkCell = VkCell;


})(jQuery);
