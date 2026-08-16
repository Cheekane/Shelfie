from django.contrib import admin

from .models import LibraryBook, PendingDetection

admin.site.register(LibraryBook)
admin.site.register(PendingDetection)
