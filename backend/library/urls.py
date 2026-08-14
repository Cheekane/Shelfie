from django.urls import path

from . import views

urlpatterns = [
    path("library/", views.library_collection, name="library_collection"),
]
