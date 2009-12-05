from django.conf.urls.defaults import *

# Uncomment the next two lines to enable the admin:
# from django.contrib import admin
# admin.autodiscover()

urlpatterns = patterns('',
    # Example:
    # (r'^voodookit/', include('voodookit.foo.urls')),

    # Uncomment the admin/doc line below and add 'django.contrib.admindocs' 
    # to INSTALLED_APPS to enable admin documentation:
    # (r'^admin/doc/', include('django.contrib.admindocs.urls')),

    # Uncomment the next line to enable the admin:
    # (r'^admin/(.*)', admin.site.root),

    url(r'^$', 'vkdoc.views.site_index', name='site-index'),
    url(r'^voodookit/$', 'vkdoc.views.vkit_index', name='vkdoc-index'),
    url(r'^voodookit/demos/$', 'vkdoc.views.vkit_demos', name='vkdoc-demos'),
    url(r'^voodookit/tests/$', 'vkdoc.views.vkit_tests', name='vkdoc-tests'),
    url(r'^voodookit/tests/example_page_data/$', 'vkdoc.views.vkit_tests_example_page_data', name='vkdoc-tests-example-page-data'),
    url(r'^voodookit/dev/$', 'vkdoc.views.vkit_dev', name='vkdoc-dev'),
    url(r'^voodookit/ref/$', 'vkdoc.views.vkit_ref', name='vkdoc-ref'),
#    url(r'^voodookit/2/$', 'vkdoc.views.vkit_index2', name='vkdoc-index-2'),

    # static files
    (r'^static/(?P<path>.*)$', 'django.views.static.serve', 
     {'document_root': 'static'}),
)
