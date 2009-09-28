# vkdoc.templatetags.exampletool

from django import template
from django.utils.html import escape
from django.utils.safestring import mark_safe

import re

import logging

register = template.Library()

def format_code_lines_as_html(html_lines):
        while len(html_lines[0].strip()) == 0:
            html_lines = html_lines[1:]
        while len(html_lines[-1].strip()) == 0:
            html_lines = html_lines[:-1]

        minimal_indent = reduce(min, [ len(x)-len(x.lstrip()) for x in html_lines ])

        html_lines_escaped = []

        for line in html_lines:
            line = line[minimal_indent:]
            linepad = len(line)-len(line.lstrip())
            logging.info("LINE pad=%d" % linepad)
            html_lines_escaped.append("&nbsp;"*linepad + re.sub(r' ', '&nbsp;', escape(line[linepad:])))
        
        return "<br/>".join(html_lines_escaped)


class ExampleNode(template.Node):
    """Outer container for a voodookit example:

    {% example "demo1" %}

      {% htmlcode %}
      <table id="{{eid}}"><tr><td>hi!</td></tr></table>
      {% endhtmlcode %}

      {% jscode %}
      var vk = $("table").voodoo();
      {% endjscode %}

    {% endexample %}
    """
    def __init__(self, example_id, 
                 nodelist_prehtmlcode,
                 nodelist_htmlcode,
                 nodelist_prejscode,
                 nodelist_jscode,
                 nodelist_postlude):
        self.example_id = example_id
        self.nodelist_prehtmlcode = nodelist_prehtmlcode
        self.nodelist_htmlcode = nodelist_htmlcode
        self.nodelist_prejscode = nodelist_prejscode
        self.nodelist_jscode = nodelist_jscode
        self.nodelist_postlude = nodelist_postlude


    def render(self, context):
        result = ["<div class='example %s'>" % self.example_id ]

        context["eid"] = self.example_id

        result.append( self.nodelist_prehtmlcode.render(context) )

        result.append("<h2>HTML</h2>")
        result.append("<div class='htmlcode'>")

        result.append( format_code_lines_as_html(self.nodelist_htmlcode.render(context).split("\n")) )


        result.append("</div>")

        result.append("<h2>Javascript</h2>")
        result.append("<div class='jscode'>")
        result.append( format_code_lines_as_html(self.nodelist_jscode.render(context).split("\n")) )
        result.append("</div>")

        result.append("<h2><b>Demos and Tests</b></h2>")
        result.append("<div class='demo'>")
        result.append( self.nodelist_htmlcode.render(context) )
        result.append( """<script type='text/javascript'>
try {
  %s
} catch(e) {
  if(window["console"] && console.log) {
    //console.error(e.toString());
    console.error(e);
  } else {
    alert("Error attempting to run %s: " + e);
  }
}
</script>
</div>""" % (self.nodelist_jscode.render(context),self.example_id))

        result.append(self.nodelist_postlude.render(context))
        result.append("</div><!--end example-->")

        return "\n".join(result)


example_serial_number = 0

@register.tag
def example(parser, token):

    if not hasattr(parser, "_reset_example_count"):
        parser._reset_example_count = True
        example_serial_number = 0

    try:
        tag_name, codename = token.split_contents()

    except ValueError:
        tag_name = token.contents.split()[0]
        global example_serial_number
        example_serial_number += 1
        codename = '"e%d"' % example_serial_number
        #raise template.TemplateSyntaxError, "%r tag requires a single argument" % token.contents.split()[0]

    if not (codename[0] == codename[-1] and codename[0] in ('"', "'")):
        raise template.TemplateSyntaxError, "%r tag's argument should be in quotes" % tag_name

    example_id = codename[1:-1]

    nodelist_prehtmlcode = parser.parse(('htmlcode',))
    parser.delete_first_token()
    nodelist_htmlcode = parser.parse(('endhtmlcode',))
    parser.delete_first_token()
    nodelist_prejscode = parser.parse(('jscode',))
    parser.delete_first_token()
    nodelist_jscode = parser.parse(('endjscode',))
    parser.delete_first_token()
    nodelist_postlude = parser.parse(('endexample',))
    parser.delete_first_token()
    #parser.delete_first_token()

    return ExampleNode(example_id,
                       nodelist_prehtmlcode,
                       nodelist_htmlcode,
                       nodelist_prejscode,
                       nodelist_jscode,
                       nodelist_postlude)
                       

class ClickToRunNode(template.Node):
    def __init__(self, nodelist):
        self.nodelist = nodelist

    def render(self, context):
        code = self.nodelist.render(context)

        return "<p>Demo: <a class='codelink' href='#' onclick='var k=%s; if(k){alert(k)}; return false;'>%s</a></p>" % (
            code,
            escape(code),
            )

@register.tag
def clicktorun(parser, token):
    nodelist_ctr = parser.parse(('endclicktorun',))
    parser.delete_first_token()
    
    return ClickToRunNode(nodelist_ctr)



class DocTestNode(template.Node):
    def __init__(self, serial_number, nodelist_code, nodelist_expect, intro, outro):
        self.nodelist_code = nodelist_code
        self.nodelist_expect = nodelist_expect
        self.serial_number = serial_number
        self.intro = intro
        self.outro = outro

    def render(self, context):
        code = self.nodelist_code.render(context)
        expect = self.nodelist_expect.render(context)

        

        return """
%(intro)s

<p id='%(testid)s'><span class='teststatus'>?</span>Test: <a class='codelink' href='#' onclick='alert(%(code)s); return false;'>%(code_esc)s</a> &rarr; <span class='test_result'>?</span> <span class='hide_on_pass'>(expected %(expect_esc)s)</span></p>

%(outro)s

<script type='text/javascript'>
$(function() {
  var $allresults = $("#all_test_results");

  var result_counts;

  if($allresults.data("counts")) {
      result_counts = $allresults.data("counts");
  } else {
      result_counts = { "run":0, "pass":0, "fail":0, "err":0 };
      $allresults.data("counts", result_counts);
  }

  result_counts["run"]++;

  try {
      var testresult = %(code)s;
      $("p#%(testid)s span.test_result").text( ""+testresult );

      if(testresult ==  %(expect)s) {
          //Test Pass
          $("p#%(testid)s span.teststatus").addClass("pass").text("Pass");
          $("p#%(testid)s .hide_on_pass").hide();

          result_counts["pass"]++;
          


      } else {
          //Test Fail
          $("p#%(testid)s span.teststatus").addClass("fail").text("Fail");
          result_counts["fail"]++;

      }
  } catch(e) {
      $("p#%(testid)s span.teststatus").addClass("error").text("Error").attr("title",e.toString());

      result_counts["err"]++;
  }

  var failstatus = "all OK";
  if(result_counts["fail"] || result_counts["err"]) {
      failstatus = result_counts["fail"] + " failures, " + result_counts["err"]+" errors";
      $allresults.attr("class","fail");
  } else {
      $allresults.attr("class","pass");
  }
  $allresults.html("<b>Tests:</b> ran "+result_counts["run"]+", "+failstatus+".");

})
</script>
""" % {
            "testid": self.serial_number,
            "code": code,
            "code_esc": escape(code),
            "expect": expect,
            "expect_esc": escape(expect),
            "intro": self.intro.render(context),
            "outro": self.outro.render(context),
            }

test_serial_number = 0

@register.tag
def doctest(parser, token):
    intro = parser.parse(('code',))
    parser.delete_first_token()
    
    nodelist_code = parser.parse(('endcode',))
    parser.delete_first_token()

    ignore = parser.parse(('expect',))
    parser.delete_first_token()

    nodelist_expect = parser.parse(('endexpect',))
    parser.delete_first_token()

    outro = parser.parse(('enddoctest',))
    parser.delete_first_token()

    global test_serial_number
    test_serial_number += 1

    return DocTestNode("test%d" % test_serial_number, nodelist_code, nodelist_expect, intro, outro)
