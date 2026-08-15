from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .models import LibraryBook
from .serializers import LibraryBookSerializer


@api_view(["GET", "POST"])
def library_collection(request: Request) -> Response:
    if request.method == "GET":
        # queries all library books
        books = LibraryBook.objects.all()
        # serializes then sends the data
        return Response({"books": LibraryBookSerializer(books, many=True).data})

    # POST: confirm a batch of books into the library.
    serializer = LibraryBookSerializer(data=request.data.get("books", []), many=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({"books": serializer.data}, status=201)
