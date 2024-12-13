# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _, tools

from odoo.tools import float_compare, float_is_zero, format_date
import psycopg2
from odoo.osv.expression import AND
from collections import defaultdict
from datetime import datetime

import logging

_logger = logging.getLogger(__name__)

class PosOrder(models.Model):
    _inherit = 'pos.order'
    state = fields.Selection(selection_add=[
        ('waiting', 'En espera')
    ], ondelete={'waiting': 'set default'})

    date_order_pending = fields.Datetime(string='Fecha de Envio', readonly=True, index=True)
    # date_order_process = fields.Datetime(string='Fecha de Envio', readonly=True, index=True, default=fields.Datetime.now)

    sequence_number_init = fields.Integer(string='Secuencia Inicial')
    session_id_init = fields.Many2one(
        'pos.session', string='Sesion Inicial', index=True)
    config_id_init = fields.Many2one('pos.config', related='session_id_init.config_id', string="Punto de Venta Inicial", readonly=False, store=True)

    seller_pos_id = fields.Integer(string="Vendedor ID" )
    seller_user_id = fields.Many2one('res.users', string='Vendedor')
    seller_name = fields.Char('Nombre del Vendedor')

    employee_pos_id = fields.Integer(string="Empleado ID")
    employee_user_id = fields.Many2one('hr.employee', string='Empleado')
    config_id_waiting= fields.Many2one('pos.config', string="Punto de Venta Espera")
    config_waiting_id = fields.Integer(string="POS Espera ID" )
    session_id_waiting = fields.Many2one(
        'pos.session', string='Sesion Espera', index=True)


    @api.model
    def sync_from_ui(self, orders):
        for order in orders:
            existing_order = self.env['pos.order'].search([('uuid', '=', order.get('uuid'))])
            if existing_order and existing_order.state == 'waiting':
                existing_order.state='draft'
        result = super().sync_from_ui(orders)
        return result

    @api.model
    def search_waiting_order_ids(self, config_id, domain, limit, offset):
        print('config_id: ',config_id,'   domain: ',domain,'  limit: ',limit,'   offset:',offset)
        # Dominio por defecto para buscar órdenes en estado 'waiting'
        default_domain = [('state', '=', 'waiting')]

        # Si hay un dominio adicional, lo combinamos con el dominio predeterminado
        if domain:
            real_domain = AND([domain, default_domain])
        else:
            real_domain = AND([[('config_id', '=', config_id)], default_domain])
        print('real_domain: ',real_domain)
        # Buscar las órdenes que coinciden con el dominio
        orders = self.search(real_domain, limit=limit, offset=offset, order='create_date desc')
        print('orders: ',orders)
        # Obtener la configuración del POS
        pos_config = self.env['pos.config'].browse(config_id)
        print('pos_config: ',pos_config)
        # Filtrar las órdenes para que solo se incluyan las que tienen la misma moneda que la configuración del POS
        orders = orders.filtered(lambda order: order.currency_id == pos_config.currency_id)
        print('orders: ',orders)

        # Ya que las órdenes en estado 'waiting' no requieren refund, no necesitamos buscar líneas de pedido refundadas.
        # Ahora solo buscamos las líneas de pedido relacionadas con las órdenes
        orderlines = self.env['pos.order.line'].search([('order_id', 'in', orders.ids)])
        print('orderlines: ',orderlines)

        # Crear un diccionario con la fecha de la última modificación de cada pedido
        orders_info = defaultdict(lambda: datetime.min)
        for orderline in orderlines:
            key_order = orderline.order_id.id
            if orders_info[key_order] < orderline.write_date:
                orders_info[key_order] = orderline.write_date

        # Obtener el conteo total de las órdenes que cumplen con el dominio
        totalCount = self.search_count(real_domain)
        print('totalCount: ',totalCount)
        print(list(orders_info.items())[::-1])
        # Devolver la información de las órdenes y el conteo total
        return {'ordersInfo': list(orders_info.items())[::-1], 'totalCount': totalCount}

    @api.model
    def search_paid_order_ids(self, config_id, domain, limit, offset):
        """Search for 'paid' orders that satisfy the given domain, limit and offset."""
        default_domain = [('state', '!=', 'draft'), ('state', '!=', 'cancel'), ('state', '!=', 'waiting')]
        if domain == []:
            real_domain = AND([[['config_id', '=', config_id]], default_domain])
        else:
            real_domain = AND([domain, default_domain])
        orders = self.search(real_domain, limit=limit, offset=offset, order='create_date desc')
        # We clean here the orders that does not have the same currency.
        # As we cannot use currency_id in the domain (because it is not a stored field),
        # we must do it after the search.
        pos_config = self.env['pos.config'].browse(config_id)
        orders = orders.filtered(lambda order: order.currency_id == pos_config.currency_id)
        orderlines = self.env['pos.order.line'].search(['|', ('refunded_orderline_id.order_id', 'in', orders.ids), ('order_id', 'in', orders.ids)])

        # We will return to the frontend the ids and the date of their last modification
        # so that it can compare to the last time it fetched the orders and can ask to fetch
        # orders that are not up-to-date.
        # The date of their last modification is either the last time one of its orderline has changed,
        # or the last time a refunded orderline related to it has changed.
        orders_info = defaultdict(lambda: datetime.min)
        for orderline in orderlines:
            key_order = orderline.order_id.id if orderline.order_id in orders \
                            else orderline.refunded_orderline_id.order_id.id
            if orders_info[key_order] < orderline.write_date:
                orders_info[key_order] = orderline.write_date
        totalCount = self.search_count(real_domain)
        return {'ordersInfo': list(orders_info.items())[::-1], 'totalCount': totalCount}



    def _process_saved_order(self, draft):
        print("***********  _process_saved_order *****************")
        print("self.state : ",self.state)
        if self.state=='waiting':
            draft=True
            if self.config_waiting_id:
                pos_config = self.env['pos.config'].browse(self.config_waiting_id)
                self.config_id_waiting = pos_config
                self.session_id_waiting = pos_config.current_session_id
                self.session_id = pos_config.current_session_id
                # self.config_id=pos_config
        return super()._process_saved_order(draft)


    def _create_order_picking(self):
        self.ensure_one()
        if self.state!='waiting':
            super()._create_order_picking()



    def action_pos_order_cancel(self):
        cancellable_orders = self.filtered(lambda order: order.state in ('draft','waiting','waiting'))
        for order in cancellable_orders:
            pickings = order.picking_ids.filtered(lambda p: p.state == 'done')
            if pickings:
                for picking in pickings:
                    picking.action_cancel()
            # for inv in order.invoice_ids:
            #     if inv and inv.state in ('posted'):
            #         inv.with_context(force_delete=True).all_in_one_force_delete_invoice_and_related_payment()

        cancellable_orders.write({'state': 'cancel'})




    @api.model_create_multi
    def create(self, vals_list):
        res = super(PosOrder, self).create(vals_list)
        for rec in res:
            if rec.seller_pos_id:
                rec.seller_user_id = rec.seller_pos_id
            if rec.employee_pos_id:
                rec.employee_user_id = rec.employee_pos_id
        return res
