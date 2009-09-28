# vkdoc.views
from django.http import HttpResponse, Http404, HttpResponseRedirect, HttpResponseNotModified, HttpResponseNotAllowed, HttpResponseForbidden
from django.core.urlresolvers import reverse
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext

def index(request):
    return render_to_response("index.html", {}, RequestContext(request))

def index2(request):
    return render_to_response("index2.html", {}, RequestContext(request))
