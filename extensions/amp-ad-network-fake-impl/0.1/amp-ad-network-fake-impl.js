/**
 * Copyright 2016 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {AmpA4A} from '../../amp-a4a/0.1/amp-a4a';
import {
  AMP_SIGNATURE_HEADER,
} from '../../amp-a4a/0.1/signature-verifier';
import {dev, user} from '../../../src/log';
import {getMode} from '../../../src/mode';
import {resolveRelativeUrl} from '../../../src/url';


export class AmpAdNetworkFakeImpl extends AmpA4A {

  /**
   * @param {!Element} element
   */
  constructor(element) {
    super(element);
  }

  /** @override */
  buildCallback() {
    user().assert(this.element.hasAttribute('src'),
        'Attribute src required for <amp-ad type="fake">: %s', this.element);
    super.buildCallback();
  }

  /** @override */
  isValidElement() {
    // Note: true is the default, so this method is not strictly needed here.
    // But a network implementation might choose to implement a real check
    // in this method.
    return true;
  }

  /** @override */
  getAdUrl() {
    return resolveRelativeUrl(
        this.element.getAttribute('src'),
        '/extensions/amp-ad-network-fake-impl/0.1/data/');
  }

  /** @override */
  sendXhrRequest(adUrl) {
    return super.sendXhrRequest(adUrl).then(response => {
      if (!response) {
        return null;
      }
      const {status, headers} =
          /** @type {{status: number, headers: !Headers}} */ (response);
      if (getMode().localDev) {
        // In the fake signature mode the content is the plain AMP HTML. This
        // mode is only allowed in `localDev` and primarily used for A4A
        // Envelope for testing. See DEVELOPING.md for more info.
        if (this.element.getAttribute('fakesig') == 'true') {
          return response.text().then(
              responseText => new Response(
                  this.transformCreativeLocalDev_(responseText),
                  {status, headers}));
        }
      }
      // Normal mode: the content is a JSON structure with two fields:
      // `creative` and `signature`.
      return response.json().then(decoded => {
        dev().info(
            'AMP-AD-FAKE', 'Decoded response text =', decoded['creative']);
        dev().info('AMP-AD-FAKE', 'Decoded signature =', decoded['signature']);
        headers.set(AMP_SIGNATURE_HEADER, decoded['signature']);
        return new Response(decoded['creative'], {status, headers});
      });
    });
  }

  /**
   * Converts a general AMP doc to a AMP4ADS doc. Only used in localDev.
   * @param {string} source
   * @return {string}
   */
  transformCreativeLocalDev_(source) {
    const doc = new DOMParser().parseFromString(source, 'text/html');
    const root = doc.documentElement;

    // <html ⚡> -> <html ⚡4ads>
    if (root.hasAttribute('⚡')) {
      root.removeAttribute('⚡');
    } else if (root.hasAttribute('amp')) {
      root.removeAttribute('amp');
    } else if (root.hasAttribute('AMP')) {
      root.removeAttribute('AMP');
    }
    if (!root.hasAttribute('⚡4ads') && !root.hasAttribute('⚡4ADS')) {
      root.setAttribute('amp4ads', '');
    }

    // Remove all AMP scripts.
    const extensions = [];
    const scripts = doc.head.querySelectorAll('script[src]');
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      if (script.hasAttribute('custom-element')) {
        extensions.push(script.getAttribute('custom-element'));
      } else if (script.hasAttribute('custom-template')) {
        extensions.push(script.getAttribute('custom-template'));
      }
      doc.head.removeChild(script);
    }

    // Remove boilerplate styles.
    const styles = doc.head.querySelectorAll('style[amp-boilerplate]');
    for (let i = 0; i < styles.length; i++) {
      const style = styles[i];
      style.parentNode.removeChild(style);
    }

    let creative = root./*OK*/outerHTML;

    // Metadata
    creative += '<script type="application/json" amp-ad-metadata>';
    creative += '{';
    creative += '"ampRuntimeUtf16CharOffsets": [0, 0],';
    creative += '"customElementExtensions": [';
    for (let i = 0; i < extensions.length; i++) {
      if (i > 0) {
        creative += ',';
      }
      creative += `"${extensions[i]}"`;
    }
    creative += ']';
    creative += '}';
    creative += '</script>';

    return creative;
  }
}


AMP.extension('amp-ad-network-fake-impl', '0.1', AMP => {
  AMP.registerElement(
      'amp-ad-network-fake-impl', AmpAdNetworkFakeImpl);
});
