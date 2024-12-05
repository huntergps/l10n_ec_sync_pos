{
    'name': 'Ecuadorian Localization Sync POS Order to share',
    'version': '18.01',
    'summary': 'Customization module for Ecuadorian localization to Sync POS Order to share sending to the server',
    'description': """
    Este módulo permite enviar las ordenes de venta de pos al servidor
    """,
    'icon': '/account/static/description/l10n.png',
    'countries': ['ec'],
    'author': 'Elmer Salazar Arias',
    'category': 'Point of Sale/Localizations/',
    'maintainer': 'Elmer Salazar Arias',
    'website': 'http://www.galapagos.tech',
    'email': 'esalazargps@gmail.com',
    'license': 'LGPL-3',
    'depends': [
        'l10n_ec_base',
        'sale',
        'purchase',
        'point_of_sale',
        'l10n_ec_edi_pos',

    ],
    'data': [
        'security/ir.model.access.csv',
        'views/res_config_settings_views.xml',
        'views/pos_order_view.xml',
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'l10n_ec_sync_pos/static/src/**/*',
        ],
    },
    'demo': [],
    'installable': True,
    'application': True,
    'auto_install': False,
}
