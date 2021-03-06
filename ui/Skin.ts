'use strict';

import * as extend from '../core/extend'
import Properties from '../core/ext/Properties'
import { Template, ResultFunction, default as nineplate } from '../nineplate'
import * as def from '../core/deferredUtils'
import { StyleType } from '../css'

declare var require: any;

class Skin extends Properties {
	cssList: StyleType[];
	template: ResultFunction | string;
	enabled: boolean = false;
	applies () { //override to define a 'rule' that tells whether this skin applies or not to your widget
		return true;
	}
	templateSetter (value: any): void {
		if (typeof(value) === 'function') {
			this.template = value;
		}
		else if (value && value.compileDom) {
			this.template = value.compileDom(true);
		}
		else {
			this.template = value;
		}
	}
	enable (widget: { domNode: any, mixinProperties: (obj: any) => void }) {
		var cnt: number,
			nTemplate: Template,
			templateResult: any,
			self = this,
			defer = def.defer();
		if (this.cssList){
			for(cnt = 0; cnt < this.cssList.length; cnt += 1) {
				this.cssList[cnt] = this.cssList[cnt].enable();
			}
		}
		if (this.template) {
			let template: ResultFunction;
			if (typeof(this.template) === 'string') {
				let templateString = this.template as string;
				nTemplate = nineplate.buildTemplate(templateString);
				template = nTemplate.compileDom(true);
				this.template = template;
			}
			else {
				template = this.template as ResultFunction;
			}
			var parentNode: HTMLElement;
			var oldNode: HTMLElement;
			if (widget.domNode && widget.domNode.parentNode) {
				parentNode = widget.domNode.parentNode;
				oldNode = widget.domNode;
			}
			var afterLoadDeps = function () {
				templateResult = template(widget);
				if (widget.mixinProperties){
					widget.mixinProperties(templateResult);
				}
				else {
					extend.mixin(widget, templateResult);
				}
				if (parentNode) {
					parentNode.replaceChild(widget.domNode, oldNode);
				}
				defer.resolve(true);
			};
			if (template.amdDependencies && template.amdDependencies.length) {
				require(template.amdDependencies || [], afterLoadDeps);
			}
			else {
				afterLoadDeps();
			}
		}
		return defer.promise;
	}
	disable () : void {
		var cnt: number = 0;
		if (this.cssList){
			for(cnt = 0; cnt < this.cssList.length; cnt += 1) {
				this.cssList[cnt] = this.cssList[cnt].disable();
			}
		}
	}
	updated (control: any) : void {
	}
}
Skin.prototype.cssList = [];
export default Skin;