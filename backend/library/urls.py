from django.urls import path

from . import views

urlpatterns = [
    path("scan/", views.scan_photo, name="scan_photo"),
    path("pending/", views.pending_collection, name="pending_collection"),
    path("pending/<int:pending_id>/", views.pending_detail, name="pending_detail"),
    path("library/", views.library_collection, name="library_collection"),
]
