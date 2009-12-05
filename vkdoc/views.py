# vkdoc.views
from django.http import HttpResponse, Http404, HttpResponseRedirect, HttpResponseNotModified, HttpResponseNotAllowed, HttpResponseForbidden
from django.core.urlresolvers import reverse
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext

def site_index(request):
    return render_to_response("site_index.html", {}, RequestContext(request))

def vkit_index(request):
    return render_to_response("vkit_index.html", { 
            "in_voodookit": True,
            "vknav": "index",
            }, RequestContext(request))

# def vkit_index2(request):
#     return render_to_response("vkit_index2.html", { "in_voodookit": True }, RequestContext(request))


def vkit_demos(request):
    return render_to_response("vkit_demos.html", { 
            "in_voodookit": True,
            "vknav": "demos",
            }, RequestContext(request))

def vkit_tests(request):
    return render_to_response("vkit_tests.html", { 
            "show_test_count": True,
            "in_voodookit": True,
            "vknav": "tests",
            }, RequestContext(request))

def vkit_ref(request):
    return render_to_response("vkit_ref.html", { 
            "in_voodookit": True,
            "vknav": "ref",
            }, RequestContext(request))

def vkit_dev(request):
    return render_to_response("vkit_dev.html", { 
            "in_voodookit": True,
            "vknav": "dev",
            }, RequestContext(request))


def vkit_tests_example_page_data(request):
    return render_to_response("vkit_tests_example_page.html",
                              { "page": request.REQUEST.get("page",0) })
