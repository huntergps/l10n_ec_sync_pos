# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models



class POSConfig(models.Model):
    _inherit = 'pos.config'

    pos_sender = fields.Boolean(string='Es Emisor')
    pos_receiver = fields.Boolean(string='Es Receptor')

    def get_config(self):
        pos_configs = self.search_read([])
        return pos_configs



class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    pos_sender = fields.Boolean(related='pos_config_id.pos_sender', readonly=False)
    pos_receiver = fields.Boolean(related='pos_config_id.pos_receiver', readonly=False)
