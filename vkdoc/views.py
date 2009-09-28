# vkdoc.views
from django.http import HttpResponse, Http404, HttpResponseRedirect, HttpResponseNotModified, HttpResponseNotAllowed, HttpResponseForbidden
from django.core.urlresolvers import reverse
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext

def site_index(request):
    return render_to_response("site_index.html", {}, RequestContext(request))

def vkit_index(request):
    return render_to_response("vkit_index.html", { "in_voodookit": True }, RequestContext(request))

def vkit_index2(request):
    return render_to_response("vkit_index2.html", { "in_voodookit": True }, RequestContext(request))
