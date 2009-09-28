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


    function VkCell(vkTable, $td, columnIndex) {
        this.vkTable = vkTable;
        this.columnIndex = columnIndex;
        this.isEmpty = false;
        this.$td = $td;

        var valuestring = $td.html();

        if(valuestring == "") {
            this._value = this.getColType().emptyValue();
            this.isEmpty = true;
        } else {
            this._value = this.getColType().parseValue(valuestring);
        }
    }

    VkCell.prototype.value = function(newValue) {
        if(typeof newValue == "undefined") {
            return this._value;
        } else {
            this.isEmpty = false;
            return this._value= newValue;
        }
    };

    VkCell.prototype.toString = function() {
        return ""+this.value();
    };

    VkCell.prototype.getCol = function() {
        return this.vkTable.col(this.columnIndex);
    };

    VkCell.prototype.getColType = function() {
        return this.getCol().coltype;
    };

    function VkColumn(vkTable, index, coltype, renderer) {
        this.vkTable = vkTable;
        this.index = index;
        this.coltype = coltype;
        this.render = renderer;
    };

    VkColumn.prototype.cells = function() {
        return $.map( this.vkTable.$table.find("tr td:nth-child("+(this.index+1)+")"),
                      function(e) { return $(e).data("vkCell"); } );
    };

    VkColumn.prototype.cellValues = function() {
        return $.map( this.cells(), function(c) { return c.value(); } );
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
            $(allrows[i]).trigger("vkRender", { "rowIndex": i });
        }
    };

    VkColumn.prototype.sortReverse = function() {
        return this.sort(true);
    };

    VkColumn.prototype.sortReverseBlanksLast = function() {
        return this.sort(true,true);
    };




    function VkTable(table, options) {
        this.table = table;
        this.$table = $(table);
        
        // Vk state
        // <table>: $(table).data("voodookit")
        // <tr>: .data("vkRow")
        // <td>: .data("vkCell")
        // <th>: .data("vkHeaderCell")

        this.columns = [];

        if(options["cols"]) {
            for(var i = 0; i < options["cols"].length; i++) {

                var colopts = { 
                        "type": $.voodoo.types.string,
                        "render": new $.voodoo.render.String() 
                };

                $.extend(colopts, options["cols"][i] || {})

                var coltype = colopts["type"];
                var render = colopts["render"];

                this.columns.push(new VkColumn(this, i, coltype, render));
            }
        }

        var thisvkt = this;
        
        var contentRowIndex = 0;

        this.$table.find("tr").each(function(rowIndex) {
                var $this = $(this);

                var is_content_row = false;

                $this.find("td").each(function(columnIndex) {
                        is_content_row = true;

                        if(columnIndex >= thisvkt.columns.length) {
                            thisvkt.columns.push(new VkColumn(thisvkt, columnIndex, $.voodoo.types.string, new $.voodoo.render.String() ) );
                        }
                        var $td = $(this);

                        var vkc = new VkCell(thisvkt, $td, columnIndex);
                        $td.data("vkCell", vkc);

                        // render value into cell
                        thisvkt.columns[columnIndex].render.renderCell(vkc);

                        //if(thisvkt.columns[columnIndex].coltype["render"]) {
                        //    $(this).html(vkc.render());
                        //}
                    });

                if(is_content_row) {
                    $this.trigger("vkRender", { "rowIndex": contentRowIndex });
                    contentRowIndex++;
                };
                
            });
    }

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
        return this.columns[index];
    };

    VkTable.prototype.makeHeadersSort = function() {
        var thisvkt = this;

        this.$table.find("tr:first th").each(function(i) { 
                $(this).unbind("click").bind("click", function() { 
                        //alert("SORTING column "+$(this).text());
                        thisvkt.col(i).sort();
                    }) 
            });
    };


    $.fn.voodoo = function(options) {

        var result = [];
        
        this.each(function(i) {
                var $this = $(this);

                if(!$this.data("voodookit")) {
                    $this.data("voodookit", new VkTable(this, options || {}));
                }

                result.push($this.data("voodookit"));
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
    typeCls.DateTime.prototype.render = function(v) {
        return v? v.toLocaleString() : "";
    };
    
    typeCls.Date = function() {};
    typeCls.Date.prototype = new typeCls.DateTime();
    typeCls.Date.prototype.render = function(v) {
        return v? v.toLocaleDateString() : "";
    };

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

    renderCls.String = function(_opts) {
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
    };
    renderCls.String.prototype.renderCell = function(vkc) {
        var val;
        if(vkc.isEmpty) {
            if(!this.useDefaultValue) {
                vkc.$td.html( this.defaultResult );
                return;
            } else {
                val = this.defaultValue;
            }
        } else {
            val = vkc.value().toString();
        }
        vkc.$td.text( val );
    };


    renderCls.TextField = function(_opts) {};
    renderCls.TextField.prototype.renderCell = function(vkc) {
        var val = vkc.value();

        var $input = $("<input type='text'>");
        $input.val(val);
        $input.bind("change", function(e) { vkc.value($input.val()); });

        vkc.$td.html("");
        vkc.$td.append($input);
    };

    renderCls.CheckboxField = function(_opts) {};
    renderCls.CheckboxField.prototype.renderCell = function(vkc) {
        var val = vkc.value();

        var $input = $("<input type='checkbox'>");
        $input.val(val);
        $input.attr("checked", val);
        $input.bind("change", function(e) { log("VAL="+$input.attr("checked")); vkc.value($input.attr("checked")); });

        vkc.$td.html("");
        vkc.$td.append($input);
    }




    $.voodoo.render = renderCls;

})(jQuery);
