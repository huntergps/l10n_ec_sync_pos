# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.tools import float_compare, float_is_zero, format_date


class PosOrder(models.Model):
    _inherit = 'pos.order'
    state = fields.Selection(selection_add=[
        ('pending', 'Pendiente Cobro')
    ], ondelete={'pending': 'set default'})

    date_order_pending = fields.Datetime(string='Fecha de Envio', readonly=True, index=True)
    # date_order_process = fields.Datetime(string='Fecha de Envio', readonly=True, index=True, default=fields.Datetime.now)

    sequence_number_init = fields.Integer(string='Secuencia Inicial')
    session_id_init = fields.Many2one(
        'pos.session', string='Sesion Inicial', index=True,
        domain="[('state', '=', 'opened')]")
    config_id_init = fields.Many2one('pos.config', related='session_id_init.config_id', string="Punto de Venta Inicial", readonly=False, store=True)

    seller_pos_id = fields.Integer(string="Vendedor ID" )
    seller_user_id = fields.Many2one('res.users', string='Vendedor')
    seller_name = fields.Char('Nombre del Vendedor')

    employee_pos_id = fields.Integer(string="Empleado ID")
    employee_user_id = fields.Many2one('hr.employee', string='Empleado')

    # def _load_pos_data_fields(self, config_id):
    #     res = super()._load_pos_data_fields(config_id)
    #     res += ['seller_pos_id', 'employee_pos_id', 'seller_name','date_order_pending']
    #     return res

    @api.model_create_multi
    def create(self, vals_list):
        res = super(PosOrder, self).create(vals_list)
        for rec in res:
            if rec.seller_pos_id:
                rec.seller_user_id = rec.seller_pos_id
            if rec.employee_pos_id:
                rec.employee_user_id = rec.employee_pos_id
        return res
