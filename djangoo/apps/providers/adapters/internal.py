"""
Internal Provider Adapter
For integrations connecting to other internal tenants via Client API
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any
import requests
import logging

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class InternalCredentials:
    """Credentials for connecting to another tenant's Client API"""
    base_url: str  # e.g. http://shamtech.localhost:3000
    api_token: str  # API token from /account/api/


class InternalAdapter:
    """
    Adapter for connecting to another tenant via Client API
    Uses /client/api/* endpoints
    """

    def get_balance(self, creds: InternalCredentials) -> dict[str, Any]:
        """
        Fetch balance from internal provider via Client API
        
        Returns:
            {'balance': float, 'currency': str}
            or {'error': str, 'message': str}
        """
        return self.fetch_balance(creds)

    def fetch_balance(self, creds: InternalCredentials) -> dict[str, Any]:
        """
        Fetch balance from internal provider via Client API
        
        Returns:
            {'balance': float, 'currency': str}
            or {'error': str, 'message': str}
        """
        if not creds.base_url:
            return {'error': 'MISSING_CONFIG', 'missingConfig': True, 'message': 'Base URL مطلوب'}
        
        if not creds.api_token:
            return {'error': 'MISSING_CONFIG', 'missingConfig': True, 'message': 'API Token مطلوب'}
        
        try:
            # Extract tenant host from base_url (e.g. shamtech.localhost:3000 -> shamtech.localhost)
            # Support formats: http://shamtech.localhost:3000, shamtech.localhost:3000, shamtech.localhost
            base_url_clean = creds.base_url.replace('http://', '').replace('https://', '').rstrip('/')
            tenant_host = base_url_clean.split(':')[0]  # Remove port if present
            
            # Always connect to Django backend on 127.0.0.1:8000
            url = 'http://127.0.0.1:8000/api-dj/users/profile'
            headers = {
                'api-token': creds.api_token,
                'X-Tenant-Host': tenant_host,  # This tells Django which tenant to use
            }
            
            logger.info(f'🔗 Fetching internal balance from {url} with tenant={tenant_host}')
            
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 401:
                return {'error': 'AUTH_ERROR', 'message': 'API Token غير صالح أو منتهي'}
            
            if response.status_code == 404:
                return {'error': 'NOT_FOUND', 'message': 'Endpoint غير موجود'}
            
            if response.status_code != 200:
                return {
                    'error': 'API_ERROR',
                    'message': f'HTTP {response.status_code}: {response.text[:200]}'
                }
            
            data = response.json()
            
            # Extract balance and currency from profile response
            balance = data.get('balance')
            currency = data.get('currency') or data.get('currencyCode') or 'USD'
            
            if balance is None:
                return {'error': 'INVALID_RESPONSE', 'message': 'لم يتم العثور على balance في الاستجابة'}
            
            return {
                'balance': float(balance),
                'currency': currency
            }
            
        except requests.exceptions.Timeout:
            return {'error': 'TIMEOUT', 'message': 'انتهت مهلة الاتصال'}
        
        except requests.exceptions.ConnectionError:
            return {'error': 'CONNECTION_ERROR', 'message': 'فشل الاتصال بالخادم'}
        
        except requests.exceptions.RequestException as e:
            return {'error': 'REQUEST_ERROR', 'message': f'خطأ في الطلب: {str(e)[:200]}'}
        
        except Exception as e:
            logger.exception('Internal adapter error')
            return {'error': 'UNKNOWN_ERROR', 'message': f'خطأ غير متوقع: {str(e)[:200]}'}

    def fetch_catalog(self, creds: InternalCredentials) -> list[dict[str, Any]]:
        """
        Fetch products catalog from internal provider via Client API
        
        Returns:
            List of products with structure:
            [{'referans': str, 'name': str, 'minQty': int, 'maxQty': int, 'cost': float, ...}, ...]
        """
        if not creds.base_url or not creds.api_token:
            raise ValueError('Base URL and API Token are required')
        
        try:
            # Extract tenant host from base_url
            base_url_clean = creds.base_url.replace('http://', '').replace('https://', '').rstrip('/')
            tenant_host = base_url_clean.split(':')[0]
            
            # Connect to Django backend
            url = 'http://127.0.0.1:8000/api-dj/products'
            headers = {
                'api-token': creds.api_token,
                'X-Tenant-Host': tenant_host,
            }
            
            logger.info(f'🔗 Fetching internal catalog from {url} with tenant={tenant_host}')
            
            response = requests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 401:
                raise ValueError('API Token غير صالح أو منتهي')
            
            if response.status_code == 404:
                raise ValueError('Products endpoint غير موجود')
            
            if response.status_code != 200:
                raise ValueError(f'HTTP {response.status_code}: {response.text[:200]}')
            
            data = response.json()
            
            
            # Normalize response structure
            products = data if isinstance(data, list) else data.get('products', [])
            
            # Transform to adapter format
            # Each product can have multiple packages, each package becomes a separate catalog item
            catalog = []
            for product in products:
                product_id = str(product.get('id', ''))
                product_name = product.get('name', '')
                product_desc = product.get('description', '')
                product_image = product.get('imageUrl') or product.get('customImageUrl')
                is_active = product.get('isActive', True) and product.get('is_active', True)
                
                # Get packages from the product
                packages = product.get('packages', [])
                
                if not packages:
                    # No packages, skip this product
                    continue
                
                for package in packages:
                    # Each package becomes a catalog item
                    package_id = str(package.get('id', ''))
                    package_name = package.get('name', '') or product_name
                    public_code = package.get('publicCode') or package.get('public_code')
                    
                    # Get cost from capital or basePrice
                    capital = package.get('capital')
                    if capital:
                        # capital might be string or number
                        try:
                            cost = float(capital)
                        except (ValueError, TypeError):
                            cost = 0.0
                    else:
                        cost = float(package.get('basePrice') or package.get('base_price') or 0)
                    
                    # Extract min/max from package
                    min_qty = package.get('minUnits') or package.get('min_units') or 1
                    max_qty = package.get('maxUnits') or package.get('max_units') or 999999
                    
                    # Use package ID as referans (unique identifier)
                    referans = f"{package_id}"
                    
                    item = {
                        # Standard adapter fields (for compatibility with views.py)
                        'id': referans,
                        'externalId': referans,
                        'name': package_name,
                        'basePrice': cost,
                        'currencyCode': 'USD',  # Internal providers use USD exclusively
                        
                        # Additional fields for flexibility
                        'referans': referans,
                        'minQty': min_qty,
                        'maxQty': max_qty,
                        'cost': cost,
                        'price': cost,
                        'currency': 'USD',  # Internal providers use USD exclusively
                        'isActive': is_active and package.get('isActive', True) and package.get('is_active', True),
                        'category': product_name,
                        'description': product_desc,
                        'publicCode': public_code,
                        'imageUrl': product_image,
                    }
                    catalog.append(item)
            
            logger.info(f'✅ Fetched {len(catalog)} package items from internal provider')
            return catalog
            
        except requests.exceptions.Timeout:
            raise ValueError('انتهت مهلة الاتصال')
        
        except requests.exceptions.ConnectionError:
            raise ValueError('فشل الاتصال بالخادم')
        
        except requests.exceptions.RequestException as e:
            raise ValueError(f'خطأ في الطلب: {str(e)[:200]}')
        
        except Exception as e:
            logger.exception('Internal catalog fetch error')
            raise ValueError(f'Failed to fetch catalog: {str(e)[:200]}')

    def list_products(self, creds: InternalCredentials) -> list[dict[str, Any]]:
        """
        Alias for fetch_catalog to match the interface of other adapters
        
        Returns:
            List of products with structure matching other adapters
        """
        return self.fetch_catalog(creds)

    def place_order(self, creds: InternalCredentials, provider_package_id: str, payload: dict) -> dict[str, Any]:
        """
        Place an order with internal provider via Client API
        
        Args:
            creds: Internal credentials
            provider_package_id: Package ID from the provider (from fetch_catalog)
            payload: Order details with 'userIdentifier', 'extraField', 'quantity', etc.
        
        Returns:
            {'status': 'success'|'failed', 'orderId': str, 'message': str, ...}
        """
        if not creds.base_url or not creds.api_token:
            return {'status': 'failed', 'message': 'Missing credentials'}
        
        try:
            # Extract tenant host from base_url
            base_url_clean = creds.base_url.replace('http://', '').replace('https://', '').rstrip('/')
            tenant_host = base_url_clean.split(':')[0]
            
            # Extract order details from payload
            quantity = payload.get('quantity', 1)
            user_identifier = payload.get('userIdentifier', '')
            extra_field = payload.get('extraField', '')
            order_id = payload.get('orderId', '')  # For tracking
            
            # Build query parameters for Client API
            params = {
                'qty': str(quantity),
                'user_identifier': user_identifier,
                'extra_field': extra_field,
            }
            if order_id:
                params['order_uuid'] = order_id
            
            # Client API endpoint: POST /client/api/newOrder/:packageId/params
            # Django backend runs on port 8000
            url = f'http://127.0.0.1:8000/client/api/newOrder/{provider_package_id}/params'
            headers = {
                'api-token': creds.api_token,
                'X-Tenant-Host': tenant_host,
            }
            
            logger.info(f'🔗 Placing order to internal provider: {url} (tenant={tenant_host})')
            logger.info(f'   📦 Params: {params}')
            logger.info(f'   🔑 Headers: {headers}')
            
            response = requests.post(url, params=params, headers=headers, timeout=30)
            
            logger.info(f'   📥 Response Status: {response.status_code}')
            logger.info(f'   📥 Response Body: {response.text[:500]}')
            
            if response.status_code == 401:
                return {'status': 'failed', 'message': 'API Token غير صالح'}
            
            if response.status_code == 404:
                return {'status': 'failed', 'message': 'Package not found'}
            
            if response.status_code not in (200, 201):
                error_text = response.text[:200]
                return {'status': 'failed', 'message': f'HTTP {response.status_code}: {error_text}'}
            
            data = response.json()
            
            logger.info(f'   ✅ Parsed Response: {data}')

            # Client API returns: {orderId, status, pin, message, ...}
            order_id = data.get('orderId') or data.get('id')
            status = str(data.get('status', 'pending') or 'pending')
            message = data.get('message') or data.get('note') or 'Order placed successfully'
            price_value = data.get('sellPriceAmount') or data.get('price') or data.get('priceUSD')
            price_currency = data.get('sellPriceCurrency') or data.get('priceCurrency') or 'USD'
            
            logger.info(f'   📋 Order ID from response: {order_id}')
            logger.info(f'   📋 Status from response: {status}')
            
            return {
                'status': status,
                'providerStatus': status,
                'orderId': str(order_id) if order_id else None,
                'externalOrderId': str(order_id) if order_id else None,
                'message': message,
                'note': data.get('note') or message,
                'pin': data.get('pin') or data.get('pinCode'),
                'cost': price_value,
                'costCurrency': price_currency,
                'data': data,
            }
            
        except requests.exceptions.Timeout:
            return {'status': 'failed', 'message': 'انتهت مهلة الاتصال'}
        
        except requests.exceptions.ConnectionError:
            return {'status': 'failed', 'message': 'فشل الاتصال بالخادم'}
        
        except requests.exceptions.RequestException as e:
            return {'status': 'failed', 'message': f'خطأ في الطلب: {str(e)[:200]}'}
        
        except Exception as e:
            logger.exception('Internal place_order error')
            return {'status': 'failed', 'message': f'خطأ غير متوقع: {str(e)[:200]}'}

    def fetch_status(self, creds: InternalCredentials, reference: str) -> dict[str, Any]:
        """Fetch order status from internal provider using Client API"""
        if not creds.base_url or not creds.api_token:
            return {'status': 'error', 'message': 'Missing credentials'}

        try:
            base_url_clean = creds.base_url.replace('http://', '').replace('https://', '').rstrip('/')
            tenant_host = base_url_clean.split(':')[0]

            url = 'http://127.0.0.1:8000/client/api/check'
            params = {'orders': reference}

            # If reference looks like UUID, ask API to treat it as order_uuid/external id
            if reference and reference.count('-') == 4 and len(reference) >= 32:
                params['uuid'] = '1'

            headers = {
                'api-token': creds.api_token,
                'X-Tenant-Host': tenant_host,
            }

            logger.info('🔄 Fetching internal order status', extra={
                'url': url,
                'params': params,
                'tenant_host': tenant_host,
            })

            response = requests.get(url, params=params, headers=headers, timeout=20)

            logger.info('   📥 Status Response: %s %s', response.status_code, response.text[:300])

            if response.status_code == 401:
                return {'status': 'unauthorized', 'message': 'API Token غير صالح'}

            if response.status_code == 404:
                return {'status': 'not_found', 'message': 'Endpoint غير موجود'}

            if response.status_code != 200:
                return {
                    'status': 'error',
                    'message': f'HTTP {response.status_code}: {response.text[:200]}',
                }

            data = response.json()
            items = data if isinstance(data, list) else data.get('data', []) if isinstance(data, dict) else []

            if not items:
                return {
                    'status': 'pending',
                    'message': 'Order not found or still processing',
                    'raw': data,
                }

            record = items[0]
            raw_status = str(record.get('status') or record.get('externalStatus') or 'pending')

            # Normalize pin/message for caller expectations
            pin_code = record.get('pin') or record.get('pinCode') or None
            message = record.get('note') or record.get('message') or record.get('desc') or ''

            return {
                'status': raw_status,
                'providerStatus': raw_status,
                'pinCode': pin_code,
                'message': message,
                'externalStatus': record.get('externalStatus'),
                'raw': record,
            }

        except requests.exceptions.Timeout:
            return {'status': 'timeout', 'message': 'انتهت مهلة الاتصال'}

        except requests.exceptions.ConnectionError:
            return {'status': 'connection_error', 'message': 'فشل الاتصال بالخادم'}

        except requests.exceptions.RequestException as exc:
            return {'status': 'error', 'message': f'خطأ في الطلب: {str(exc)[:200]}'}

        except Exception as exc:  # noqa: BLE001
            logger.exception('Internal fetch_status error')
            return {'status': 'error', 'message': f'خطأ غير متوقع: {str(exc)[:200]}'}

