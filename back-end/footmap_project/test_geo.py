from storefront.models import FoodPlace
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from rest_framework_gis.fields import GeometryField

class TestMapSerializer(GeoFeatureModelSerializer):
    geom = GeometryField()
    class Meta:
        model = FoodPlace
        geo_field = 'geom'
        fields = ['id', 'name']

fp = FoodPlace.objects.first()
print(TestMapSerializer(fp).data['geometry'])
