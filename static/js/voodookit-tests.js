$(function() {
        $(".exp").click(function() {
                var $this = $(this);
                if($this.hasClass("collapsed")) {
                    $this.removeClass("collapsed").next("div.example").show("fast");
                } else {
                    $this.addClass("collapsed").next("div.example").hide("fast");
                }

                return false;
            });

        $(".exp").addClass("collapsed").next("div.example").hide();

        $(".exp").each(function(){
                var testcount = $(this).next("div.example").find(".teststatus").length;

                $(this).prepend("<span class='testcount'>("+testcount+" test"+(testcount==1?"":"s")+")</span>");
            });

    });