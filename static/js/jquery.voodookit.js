/**

   Voodookit plugin for jQuery.
   Copyright (c) 2009 Shimon Rura, shimon@rura.org.

 **/

(function($) {
    
    var ENABLE_LOGGING = true;

    var log = function(txt) {
        if(ENABLE_LOGGING && window.console) {
            console.log(txt);
        }
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

        this.parseToValue($td.html(), true);
    }

    VkCell.prototype.row = function() {
        return this.vkRow;
    };

    VkCell.prototype.value = function(newValue) {
        //log("VkCell.prototype.value; typeof newValue="+(typeof newValue));

        if(typeof newValue != "undefined") {
            if(this.isEmpty || this._value != newValue) {
                this.isEmpty = false;
                var oldValue = this._value;
                this._value= newValue;
                this.sendChangeEvent(oldValue);
            }
        }
        return this._value;
    };

    VkCell.prototype.sendChangeEvent = function(oldValue) {
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
            this._value = this.colType().parseValue(valuestring);
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




    /** 
        VkColumn class
    **/
    function VkColumn(vkTable, index, coltype, renderer, name) {
        this.vkTable = vkTable;
        this.index = index;
        this.coltype = coltype;
        this.render = renderer;
        this.name = name;
        this._eventStub = $("<div class='vkColumn event stub'>");
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
            if(initial) {
                result = reductor(initial, values[0]);
            } else {
                result = values[0];
            }
        }

        for(var i = 1; i < values.length; i++) {
            result = reductor(result, values[i]);
        }

        return result;
    };

    VkColumn.prototype.sort = function( in_reverse, force_blanks_last ) {
        if(!in_reverse) { force_blanks_last = false; }

        var allrows = this.vkTable.$contentRows();

        var thiscol = this;

        var comparator = function(a,b) {
            var cell_a = $(a).find("td:eq("+thiscol.index+")").data("vkCell");
            var cell_b = $(b).find("td:eq("+thiscol.index+")").data("vkCell");

            if(in_reverse) {
                var tmp = cell_a;
                cell_a = cell_b;
                cell_b = tmp;
            }

            if(cell_a.isEmpty) {
                if(cell_b.isEmpty) {
                    return 0;
                } else {
                    return force_blanks_last? -1 : 1;
                }
            } else if(cell_b.isEmpty) {
                return force_blanks_last? 1: -1;
            }

            var val_a = cell_a.value();
            var val_b = cell_b.value();

            if(typeof val_a == "boolean" && typeof val_b == "boolean") {
                val_a = val_a? 1:0;
                val_b = val_b? 1:0;
            }

            if(val_a < val_b) {
                return -1;
            } else if(val_b < val_a) {
                return 1;
            } else {
                return 0;
            }
        };

        allrows.sort(comparator);

        for(var i = 0; i < allrows.length; i++) {
            this.vkTable.$table.append(allrows[i]);
            $(allrows[i]).trigger("vkRowScan", { 
                    "rowIndex": i,
                    "vkRow": $(allrows[i]).data("vkRow")
                        });
        }
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
        var col = this.vkTable.col(colId);
        return this.$tr.find("td:eq("+col.index+")").data("vkCell");
    };

    VkRow.prototype.cells = function() {
        return this.$tr.find("td").map(function() { 
                return $(this).data("vkCell"); 
            });
    };

    VkRow.prototype.prepDelete = function() {
        return this.delete(true);
    };

    VkRow.prototype.delete = function(dontRemove) {
        var result = this.$tr;

        result.trigger("vkRowDelete");

        this.vkTable.$contentRows().not(result).each(function(i) {
                $(this).trigger("vkRowScan", {
                        "rowIndex": i,
                        "vkRow": $(this).data("vkRow")
                    });
            });

        if(!dontRemove) { result.remove(); }

        return result;
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
                        "render": new $.voodoo.render.String(),
                        "name": null
                       
                };

                $.extend(colopts, options["cols"][i] || {})

                var coltype = colopts["type"];
                var render = colopts["render"];
                var name = colopts["name"]

                this.columns.push(new VkColumn(this, i, coltype, render, name));
                if(name) {
                    this.column_name_map[name] = i;
                }

            }
        }

        this.findNewRows();
    };

    VkTable.prototype.findNewRows = function() {
        var thisvkt = this;

        this.$table.find("tr:has(td)").each(function(contentRowIndex) {
                var $thistr = $(this);
                if($thistr.data("vkRow")) { return; } // skip any already-handled rows

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
                                                   new $.voodoo.render.String());
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

                        // render value into cell
                        var ren = thisvkt.columns[columnIndex].render;
                        ren.renderCell(vkc);
                        ren.listenTo(vkc);

                    });
            
                $thistr.trigger("vkRowScan", { 
                        "rowIndex": contentRowIndex,
                        "vkRow": $thistr.data("vkRow")
                });
            });
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

    VkTable.prototype.cell = function(row,col) {
        return this.$table.find("tr:has(td):eq("+row+") td:eq("+col+")").data("vkCell");
    };

    VkTable.prototype.col = function(index) {

        if(typeof index == "string") {
            index = this.column_name_map[index];
        }
        
        return this.columns[index];
    };

    VkTable.prototype.makeHeadersSort = function() {
        var thisvkt = this;

        var $headers = this.$table.find("tr:first th");

        $headers.each(function(i) { 
                $(this).unbind("click").bind("click", function() { 
                        //alert("SORTING column "+$(this).text());
                        thisvkt.col(i).sort();
                    }) 
            });

        return $headers;
    };

    VkTable.prototype.append = function() {
        var args = Array.prototype.slice.call(arguments);
        var result = this.$table.append.apply(this.$table, args);
        this.findNewRows();

        return this;
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
        parseValue: function(s) { return s; }
    };

    typeCls.String = function() {};
    typeCls.String.prototype = new typeCls.BaseType();

    typeCls.Integer = function(base) {
        if(base) { this.base = base; }
        else { this.base = 10; }
    };
    typeCls.Integer.prototype = new typeCls.BaseType();
    typeCls.Integer.prototype.parseValue = function(s) { 
        return parseInt(s, this.base); 
    };

    typeCls.Float = function() {};
    typeCls.Float.prototype = new typeCls.BaseType();
    typeCls.Float.prototype.parseValue = function(s) { 
        return parseFloat(s); 
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
        return new Date(parseFloat(s)); 
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


    // Renderers: These objects determine how a javascript value is rendered
    // into HTML for display to the user.
    var renderCls = {};


    renderCls.Base = function(_opts) { this.init(_opts); };
    renderCls.Base.prototype.init = function(_opts) {
        var opts = {
            "default": "",
        };

        $.extend(opts, _opts || {})

        this.defaultResult = opts["default"];

        if("defaultValue" in opts) {
            this.useDefaultValue = true;
            this.defaultValue = opts["defaultValue"];
        } else {
            this.useDefaultValue = false;
        }

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
        vkc.$td.html( val );
    };


    // HtmlString - same as Base, but uses .text() instead of .html()
    renderCls.String = function(_opts) { this.init(_opts); };
    renderCls.String.prototype = new renderCls.Base();
    renderCls.String.prototype.renderValueToCell = function(vkc, val) {
        vkc.$td.text( val );
    };

    // HtmlString - same as Base
    renderCls.HtmlString = function(_opts) { this.init(_opts); };
    renderCls.HtmlString.prototype = new renderCls.Base();

    // TextField - editable <input type=text>
    renderCls.TextField = function(_opts) { this.init(_opts); };
    renderCls.TextField.prototype = new renderCls.Base();
    renderCls.TextField.prototype.renderCell = function(vkc) {
        var $input = vkc.$td.find("input[type='text']");
        if(!$input.length) {
            $input = $("<input type='text'>");
            vkc.$td.empty().append($input);
            $input.bind("change", function(e) { vkc.parseToValue($input.val()); });
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
                                               
    // LocaleDate - for Date objects
    renderCls.LocaleDate = function(_opts) { this.init(_opts); };
    renderCls.LocaleDate.prototype = new renderCls.Base();
    renderCls.LocaleDate.prototype.renderValueToCell = function(vkc, val) {
        vkc.$td.text(val? val.toLocaleDateString() : "");
    };

                                               
    // LocaleDateTime - for Date objects
    renderCls.LocaleDateTime = function(_opts) { this.init(_opts); };
    renderCls.LocaleDateTime.prototype = new renderCls.Base();
    renderCls.LocaleDateTime.prototype.renderValueToCell = function(vkc, val) {
        vkc.$td.text(val? val.toLocaleString() : "");
    };


    // Hidden - hides this cell altogether
    renderCls.Hidden = function(_opts) { this.init(_opts); };
    renderCls.Hidden.prototype = new renderCls.Base();
    renderCls.Hidden.prototype.renderCell = function(vkc) {
        vkc.$td.hide();
    };


    // make renderCls publicly accessible
    $.voodoo.render = renderCls;

})(jQuery);
