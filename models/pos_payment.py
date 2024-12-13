# -*- coding: utf-8 -*-

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError

class PosPayment(models.Model):
    _inherit = 'pos.payment'
