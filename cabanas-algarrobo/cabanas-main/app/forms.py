from django import forms
from .models import Cabana

class CabanaForm(forms.ModelForm):
    class Meta:
        model = Cabana
        fields = ['nombre', 'ubicacion', 'capacidad', 'estado', 'precio_por_noche']
        widgets = {
            'nombre': forms.TextInput(attrs={'class': 'form-control'}),
            'ubicacion': forms.TextInput(attrs={'class': 'form-control'}),
            'capacidad': forms.NumberInput(attrs={'class': 'form-control'}),
            'estado': forms.TextInput(attrs={'class': 'form-control'}),
            'precio_por_noche': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
        }
