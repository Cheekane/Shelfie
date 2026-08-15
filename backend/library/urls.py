from django.urls import path

from . import views

urlpatterns = [
    path("scan/", views.scan_photo, name="scan_photo"),
    path("library/", views.library_collection, name="library_collection"),
]
