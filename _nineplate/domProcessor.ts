///<amd-dependency path="./utils/parser/amd" />
'use strict';

declare var require: any;
import * as functions from './utils/functions';
import * as def from '../core/deferredUtils';
import { XmlNode, getParsedXml, InternalNode, TextParseContext, safeFilter, trim, ExpressionToken, ParserType } from './baseProcessor';
import * as objUtils from '../core/objUtils';
import {JavascriptRenderer as Renderer, Chunk, Expression as JsExpression, Condition } from './renderers/JavascriptRenderer';
import { ResultFunction } from '../nineplate'

declare var define: any;
var parser: ParserType,
	req = require,
	isAmd = (typeof(define) !== 'undefined') && define.amd,
	isNode = typeof(window) === 'undefined';

if (isNode && !isAmd) {
	parser = req('./utils/parser/commonjs');
}
else {
	parser = require('./utils/parser/amd');
}

let svgNamespace = 'http://www.w3.org/2000/svg';

interface ElementContextType {
	mode?: string;
	needsDom?: boolean;
	asText?: boolean;
	reRenderTargets?: string[][];
	needsRerenderer?: boolean;
}
enum TargetType {
	Attr,
	Text
}

/**
Takes a template object and transforms it into a function that renders that xml (or html)
@param {string} template - XML text that we want to be compiled.
@param {bool} sync - Tells whether or not the compilation is evented (Node.js) or synchronous (The template is compiled as soon as it returns).
@param {Object} options - Options object used to modify the compilers behavior.
*/
export function compileDom(template: string, sync: boolean, options: any): any {
	var rendererStack: Renderer[] = [];
	function pushRenderer(r: Renderer) {
		rendererStack.push(r);
		return r;
	}
	function popRenderer() {
		rendererStack.pop();
		return rendererStack[rendererStack.length - 1];
	}
	var renderer = pushRenderer(new Renderer(true)),
		parentRenderer = renderer,
		amdPathMapping: { [name: string]: string } = {},
		amdEnabled = false;
	renderer
		.addGlobal('window')
		.addGlobal('Object')
		.addGlobal('Array');
	if (!options.standalone) {
		renderer.addGlobal('fn');
	}
	function enableAmd() {
		if (!amdEnabled) {
			parentRenderer
				.addGlobal('require');
			amdEnabled = true;
		}
	}
	/*
	Transforms xml text into an object model that the compiler understands
	@param {string} template - Nineplate's template object that we want to be compiled.
	*/
	function processDom (): any {
		var text = template,
			parsedXml = getParsedXml(text, sync),
			elementContext: ElementContextType = {};
		if (isNode && !sync) {
			return def.when(parsedXml, function(value: InternalNode) {
				return processParsedXml(new XmlNode(value), null, elementContext);
			}, function (error) {
//						console.log(text);
				throw error;
			});
		}
		else {
			if (isNode) {
				return processParsedXml(new XmlNode(parsedXml), null, elementContext);
			}
			else {
				return processParsedXml(new XmlNode(parsedXml.documentElement), null, elementContext);
			}
		}
	}
	function isAmdExtensionValue(v: string) {
		return (v || '').indexOf('amd://') === 0;
	}
	/*
	returns rendered code for the supplied xmlNode
	@param {XmlNode} template - Nineplate's template object that we want to be compiled.
	*/
	function processParsedXml(xmlNode: XmlNode, parentNode: XmlNode, elementContext: ElementContextType) {
		var textParseContext: TextParseContext,
			amdInstanceName: string;
		function tryNewContext(action: (ctx: ElementContextType) => void) {
			var tempCtx: ElementContextType = { mode: elementContext.mode };
			action(tempCtx);
			if (tempCtx.needsDom) {
				elementContext.needsDom = true;
			}
		}
		function nodeAct(xmlNode: XmlNode, parentXmlNode: XmlNode) {
			tryNewContext(function(tempCtx) {
				if (nodeType(xmlNode) === 3) {
					if (!elementContext.mode) {
						processParsedXml(xmlNode, parentXmlNode, elementContext);
					}
				}
				else {
					processParsedXml(xmlNode, parentXmlNode, tempCtx);
				}
			});
		}
		function processAttributeAct(xmlNode: XmlNode, nodeName: string) {
			tryNewContext(function(/*tempCtx*/) {
				processAttribute(xmlNode, nodeName, elementContext);
			});
		}
		function processTextAct(nodeValue: string, target: JsExpression, targetType: TargetType) {
			tryNewContext(function(/*tempCtx*/) {
				processTextFragment(nodeValue, target, targetType, elementContext);
			});
		}
		function notSkipped (at: XmlNode) {
			return !at.get('skip');
		}

		function visitChildNodes() {
			var cnt: number,
				chunk: Chunk,
				attributes = xmlNode.getAttributes().filter(notSkipped),
				childNodes = xmlNode.getChildNodes();
			for (cnt = 0; cnt < attributes.length; cnt += 1) {
				if (!attributes[cnt].get('skip')) {
					nodeAct(attributes[cnt], xmlNode);
				}
			}
			chunk = renderer.chunk();
			renderer = pushRenderer(chunk.renderer);
			for (cnt = 0; cnt < childNodes.length; cnt += 1) {
				nodeAct(childNodes[cnt], xmlNode);
			}
			if ((!elementContext.mode) && (!elementContext.needsDom) && (!options.ignoreHtmlOptimization)) { //Taking the innerHTML route instead
				chunk.clear();
				elementContext.asText = true;
				textParseContext = new TextParseContext();
				renderer.addAssignment('result', renderer.literal([]));
				for (cnt = 0; cnt < childNodes.length; cnt += 1) {
					processParsedXml(childNodes[cnt], xmlNode, elementContext);
				}
				textParseContext.appendLine();

				attributes = xmlNode.getAttributes().filter(notSkipped);
				for (cnt = 0; cnt < attributes.length; cnt += 1) {
					nodeAct(attributes[cnt], xmlNode);
				}
				//r += childrenString;
				//r += textParseContext.getText();
				if (childNodes.length) {
					renderer
						.addAssignment(
							renderer
								.expression('node')
								.member('innerHTML'),
							renderer
								.expression('result')
								.member('join')
								.invoke(
									renderer.literal('')
								)
							);
				}
			}
			renderer = popRenderer();
		}
		function nodeType(xmlNode: XmlNode) {
			return xmlNode.nodeType();
		}
		function nodeValue(xmlNode: XmlNode) {
			return xmlNode.nodeValue();
		}
		function checkRerendering() {
			var newVarName: string,
				newFunctionName: string,
				innerCondition: Renderer,
				arr = elementContext.reRenderTargets || [],
				cnt: number,
				partCnt: number,
				partLen: number,
				part: string,
				current: string[],
				watchFn: Renderer,
				watchVariable: string,
				innerWatch: Renderer,
				forIn: Renderer,
				len = arr.length;
			if (elementContext.needsRerenderer) {
				renderer.addReturn(renderer.varName('node'));
				renderer.comment('Here starts a live expression', true);
				renderer.comment('Here ends the live expression', false);
				newFunctionName = renderer.convertToFunctionCall([]);
				newVarName = renderer.getNewVariable();
				renderer.addVar(newVarName);
				watchVariable = renderer.getNewVariable();
				renderer.addVar(watchVariable);
				renderer.addAssignment(newVarName, renderer.expression(newFunctionName).invoke());
				renderer.comment('Add trigger events here');
				watchFn = renderer.newFunction([]);
				watchFn
					.addVar('freeze', watchFn.literal({}))
					.addVar('freezeNode', watchFn.expression(newVarName));
				for (cnt = 0; cnt < forLoopVariableStack.length; cnt += 1) {
					watchFn
						.addAssignment(
							watchFn.expression('freeze').element(watchFn.literal(forLoopVariableStack[cnt])),
							watchFn.expression('context').element(watchFn.literal(forLoopVariableStack[cnt]))
						);
				}
				innerWatch = watchFn.innerFunction('wfn');
				innerWatch
					.addParameter('name')
					.addParameter('oldValue')
					.addParameter('newValue');
				innerCondition = innerWatch
					.addCondition(innerWatch.not(innerWatch.expression('oldValue').equals('newValue').parenthesis())).renderer;
				innerWatch
					.addVar('temps', innerWatch.literal({}))
					.addVar('t')
					.addVar('p');
				forIn = innerCondition.addForIn(innerWatch.expression('p'), innerWatch.expression('freeze'));
				forIn.addAssignment(forIn.expression('temps').element(forIn.raw('p')), forIn.expression('context').element(forIn.raw('p')));
				forIn.addAssignment(forIn.expression('context').element(forIn.raw('p')), forIn.expression('freeze').element(forIn.raw('p')));

				innerCondition.addAssignment('t', innerWatch.expression(newFunctionName).invoke());
				innerCondition.addStatement(
					innerCondition
						.expression('freezeNode')
						.member('parentNode')
						.member('replaceChild')
						.invoke(
							innerCondition.expression('t'),
							innerCondition.expression('freezeNode')
						)
					);
				innerCondition
					.addAssignment('freezeNode', innerWatch.expression('t'));

				forIn = innerCondition.addForIn(innerWatch.expression('p'), innerWatch.expression('freeze'));
				forIn.addAssignment(forIn.expression('context').element(forIn.raw('p')), forIn.expression('temps').element(forIn.raw('p')));

				watchFn.addReturn(watchFn.expression('wfn'));

				renderer.addAssignment(watchVariable, watchFn);
				for (cnt = 0; cnt < len; cnt += 1) {
					current = arr[cnt];
					partLen = current.length;
					renderer.addAssignment('ctxTemp', renderer.expression('context'));
					for (partCnt = 0; partCnt < partLen - 1; partCnt += 1) {
						part = current[partCnt];
						renderer.addAssignment('ctxTemp', renderer.expression('ctxTemp').element(renderer.literal(part)));
					}
					renderer
						.addCondition(renderer.expression('ctxTemp').member('watch'))
						.renderer
						.addStatement(
							renderer
								.expression('ctxTemp')
								.member('watch')
								.invoke(
									renderer.literal(current[partLen - 1]),
									renderer.expression(watchVariable).invoke()
								)
						);
				}
			}
		}
		function checkRerenderingAttribute() {
			var newVarName: string,
				newFunctionName: string,
				innerCondition: Renderer,
				arr = elementContext.reRenderTargets || [],
				cnt: number,
				partCnt: number,
				partLen: number,
				part: string,
				current: string[],
				watchFn: Renderer,
				watchVariable: string,
				innerWatch: Renderer,
				forIn: Renderer,
				len = arr.length;
			if (elementContext.needsRerenderer) {
				renderer.addReturn(renderer.varName('node'));
				renderer.comment('Here starts a live expression with attribute', true);
				renderer.comment('Here ends the live expression');
				newFunctionName = renderer.convertToFunctionCall(['node']);
				newVarName = renderer.getNewVariable();
				renderer.addVar(newVarName);
				watchVariable = renderer.getNewVariable();
				renderer.addVar(watchVariable);
				renderer.addAssignment(newVarName, renderer.expression(newFunctionName).invoke(renderer.expression('node')));
				renderer.comment('Add trigger events here');
				watchFn = renderer.newFunction([]);
				watchFn
					.addVar('freeze', watchFn.literal({}))
					.addVar('freezeNode', watchFn.expression(newVarName));
				for (cnt = 0; cnt < forLoopVariableStack.length; cnt += 1) {
					watchFn
						.addAssignment(
							watchFn.expression('freeze').element(watchFn.literal(forLoopVariableStack[cnt])),
							watchFn.expression('context').element(watchFn.literal(forLoopVariableStack[cnt]))
						);
				}
				innerWatch = watchFn.innerFunction('wfn');
				innerWatch
					.addParameter('name')
					.addParameter('oldValue')
					.addParameter('newValue');
				innerCondition = innerWatch
					.addCondition(innerWatch.not(innerWatch.expression('oldValue').equals('newValue').parenthesis())).renderer;
				innerWatch
					.addVar('temps', innerWatch.literal({}))
					.addVar('p');
				forIn = innerCondition.addForIn(innerWatch.expression('p'), innerWatch.expression('freeze'));
				forIn.addAssignment(forIn.expression('temps').element(forIn.raw('p')), forIn.expression('context').element(forIn.raw('p')));
				forIn.addAssignment(forIn.expression('context').element(forIn.raw('p')), forIn.expression('freeze').element(forIn.raw('p')));

				innerCondition.addStatement(innerWatch.expression(newFunctionName).invoke(innerWatch.expression('freezeNode')));

				forIn = innerCondition.addForIn(innerWatch.expression('p'), innerWatch.expression('freeze'));
				forIn.addAssignment(forIn.expression('context').element(forIn.raw('p')), forIn.expression('temps').element(forIn.raw('p')));


				watchFn.addReturn(watchFn.expression('wfn'));

				renderer.addAssignment(watchVariable, watchFn);
				for (cnt = 0; cnt < len; cnt += 1) {
					current = arr[cnt];
					partLen = current.length;
					renderer.addAssignment('ctxTemp', renderer.expression('context'));
					for (partCnt = 0; partCnt < partLen - 1; partCnt += 1) {
						part = current[partCnt];
						renderer.addAssignment('ctxTemp', renderer.expression('ctxTemp').element(renderer.literal(part)));
					}
					renderer
						.addCondition(renderer.expression('ctxTemp').member('watch'))
						.renderer
						.addStatement(
							renderer
								.expression('ctxTemp')
								.member('watch')
								.invoke(
									renderer.literal(current[partLen - 1]),
									renderer.expression(watchVariable).invoke()
								)
						);
					if (isAmdExtension(parentNode)) {
						var amd2Way = renderer.newFunction([]),
							amdSetter = amd2Way.newFunction([]);
						amdSetter
							.addParameter('name')
							.addParameter('old')
							.addParameter('newv')
							.addStatement(amdSetter.expression('ctxTemp').member('set').invoke(amdSetter.literal(current[partLen - 1]), amdSetter.expression('newv')));
						amd2Way
							.addParameter('ctxTemp')
							.addReturn(amd2Way.expression(amdSetter));

						renderer
							.addCondition(renderer.expression('node').member('watch'))
							.renderer
							.addStatement(
								renderer
									.expression('node')
									.member('watch')
									.invoke(
										renderer.literal(xmlNode.nodeName()),
										renderer.expression(amd2Way).parenthesis().invoke('ctxTemp')
									)
							);
					}
				}
			}
		}
		function isAmdExtension(nodeParameter: XmlNode) {
			var nsUri = ((nodeParameter || xmlNode).namespaceUri() || '');
			return isAmdExtensionValue(nsUri);
		}
		function solveAmdExtension() {
			var amdPrefix = xmlNode.namespaceUri().substr(6),
				name = xmlNode.nodeLocalName(),
				mid = amdPrefix + '/' + name,
				amdModuleVar = amdPathMapping[mid],
				instanceName: string,
				defaultCondition: Condition;
			enableAmd();
			if (!amdModuleVar) {
				amdModuleVar = renderer.getNewVariable();//Here I'm asking renderer and not parentRenderer to avoid a shadowing
				amdPathMapping[mid] = amdModuleVar;
				parentRenderer
					.addVar(
						amdModuleVar,
						parentRenderer
							.expression('require')
							.invoke(
								parentRenderer.literal(mid)
							)
					);
				let chunk = new Chunk(parentRenderer);
				defaultCondition = chunk.renderer.addCondition(renderer.expression(amdModuleVar).member('default'));
				defaultCondition.renderer.addAssignment(amdModuleVar, renderer.expression(amdModuleVar).member('default'));
				parentRenderer.addStatementAtBeginning(chunk);
			}
			instanceName = renderer.getNewVariable();
			renderer.addVar(instanceName);
			renderer.addAssignment(instanceName, renderer.createObject(amdModuleVar));
			renderer.addAssignment('node', renderer.expression(instanceName));
			return instanceName;
		}
		function showNjsWidget(instanceName: string) {
			var conditionRenderer: Renderer,
				childWidgetConditionRenderer: Renderer;
			conditionRenderer = renderer.addCondition(renderer.expression(instanceName).member('$njsWidget')).renderer;
			conditionRenderer
				.addStatement(
				conditionRenderer
					.expression(instanceName)
					.member('show')
					.invoke(
						conditionRenderer
							.expression('nodes')
							.element(
								conditionRenderer
									.expression('nodes')
									.member('length')
									.minus(conditionRenderer.literal(1))
							)
					)
				);
			childWidgetConditionRenderer = conditionRenderer
				.addCondition(
				conditionRenderer
					.expression('context')
					.member('registerChildWidget')
			).renderer;
			childWidgetConditionRenderer
				.addStatement(
				childWidgetConditionRenderer
					.expression('context')
					.member('registerChildWidget')
					.invoke(childWidgetConditionRenderer.expression('node'))
			);
		}
		if (!parentNode) {
			renderer
				.addCondition(renderer.not(renderer.varName('document'))).renderer
				.addAssignment('document', 'window.document');
			renderer
				.addVar('nodes', renderer.raw('[]'))
				.addVar('node')
				.addVar('att')
				.addVar('txn')
				.addVar('attachTemp')
				.addVar('putValue')
				.addVar('x')
				.addVar('ctxTemp')
				.addVar('y')
				.addVar('e', '(' + renderer.varName('fn') + '.tst()?' + renderer.varName('fn') + '.e:' + renderer.varName('fn') + '.ae)')
				.addVar('ens', '(' + renderer.varName('fn') + '.tst()?' + renderer.varName('fn') + '.ens:' + renderer.varName('fn') + '.aens)')
				.addVar('aens', renderer.varName('fn') + '.aens')
				.addVar('a', renderer.varName('fn') + '.a')
				.addVar('t', renderer.varName('fn') + '.t')
				.addVar('av')
				.addVar('result')
				.addVar('v');
			solveTagName(xmlNode, true, elementContext);
			renderer
				.addStatement(renderer.expression('nodes').member('push').invoke(renderer.expression('node')));
			visitChildNodes();
			checkRerendering();
			renderer.addAssignment('node', renderer.expression('nodes').member('pop').invoke());
			renderer.addAssignment(renderer.expression('r').member('domNode'), renderer.expression('node'));
		} else {
			if (nodeType(xmlNode) === 1 /* Element */ ) {
				renderer
					.addStatement(renderer.expression('nodes').member('push').invoke(renderer.expression('node')));
				renderer = pushRenderer(renderer.chunk().renderer);
				if (isAmdExtension(xmlNode)) {
					elementContext.mode = 'amdExtension';
					amdInstanceName = solveAmdExtension();
					visitChildNodes();
					showNjsWidget(amdInstanceName);
					renderer.addAssignment('node', renderer.expression('node').member('domNode'));
				}
				else {
					solveTagName(xmlNode, false, elementContext);
					visitChildNodes();
					checkRerendering();
				}
				renderer.addAssignment('node', renderer.expression('nodes').member('pop').invoke());
				renderer = popRenderer();
			} else if (nodeType(xmlNode) === 2 /* Attribute */ ) {
				renderer = pushRenderer(renderer.chunk().renderer);
				processAttributeAct(xmlNode, xmlNode.nodeName());
				checkRerenderingAttribute();
				renderer = popRenderer();
			} else if (nodeType(xmlNode) === 3 /* Text */ ) {
				renderer.addAssignment('txn', renderer.expression('t').invoke('node', renderer.literal(''), renderer.expression('node').member('ownerDocument')));
				processTextAct(nodeValue(xmlNode), renderer.expression('txn').member('nodeValue'), TargetType.Text);
			}
		}
	}
	var forLoopStack: string[] = [];
	var forLoopVariableStack: string[] = [];
	function processParsedResult(result: ExpressionToken, target: JsExpression, targetType: TargetType, elementContext: ElementContextType, compound: boolean) {
		var cnt: number,
			fName: string;
		if (result.type === 'mixed'){
			for (cnt=0; cnt < result.content.length; cnt += 1){
				processParsedResult(result.content[cnt], target, targetType, elementContext, true);
			}
		}
		else if (result.type === 'expressionToken'){
			processExpressionToken(result, target, targetType, elementContext, compound);
		}
		else if (result.type === 'any'){
			renderer
				.addAssignment(
					target,
					target.op('+', renderer.literal(safeFilter(result.content)))
				);
//					r += target + ' += \'' + baseProcessor.safeFilter(result.content) + '\';\n';
		}
		else if (result.type === 'beginFor'){
			fName = renderer.getNewVariable();
			forLoopStack.push(fName);
			forLoopVariableStack.push(result.identifier);
			renderer = pushRenderer(renderer.innerFunction(fName));
			renderer
				.addParameter('context')
				.addVar('arr')
				.addVar('temp')
				.addVar('cnt')
				.addVar('ident', renderer.literal(result.identifier));
			renderer
				.addAssignment(
					'temp',
					renderer.expression('context').element('ident')
				);
			renderer
				.addAssignment(
					'arr',
					makePutValue(result.value.value, false)
						.or(
							renderer.literal([])
						)
				);
			//r += '(function(context) {\n';
			// r += 'var arr, temp, cnt, ident;\n';
			// r += 'ident = \'' + result.identifier + '\';\n';
			//r += 'temp = context[ident];\n';
			//r += 'arr = ' + makePutValue(result.value.value, false) + ' || [];\n';
			renderer = pushRenderer(renderer
						.addFor(
							renderer.newAssignment('cnt', renderer.literal(0)),
							renderer.expression('cnt')
								.lessThan(renderer.expression('arr').member('length')),
							renderer.newAssignment('cnt', renderer.expression('cnt').plus(renderer.literal(1)))
						));
			renderer.addAssignment(renderer.expression('context').element(renderer.expression('ident')), renderer.expression('arr').element(renderer.expression('cnt')));
//					r += 'for (cnt=0;cnt < arr.length; cnt += 1) {\n';
//					r += 'context[ident] = arr[cnt];\n';
		}
		else if (result.type === 'endFor'){
			renderer = popRenderer();//Still inside the for loop //renderer.getParentRenderer();
			renderer
				.addAssignment(
					renderer
						.expression('context').member(renderer.expression('ident')),
					renderer.expression('temp')
				);
			renderer = popRenderer();//Now at real previous point //renderer = renderer.getParentRenderer();
			fName = forLoopStack.pop();
			forLoopVariableStack.pop();
			renderer
				.addStatement(
					renderer
						.expression(fName)
						.member('call')
						.invoke(
							renderer.expression('this'),
							renderer.expression('context')
						)
					);
//					r += '}\n';
//					r += 'context[ident] = temp;\n';
//					r += '}).call(this, context);\n';
		}
		else {
			throw new Error('unsupported token');
		}
	}
	function processTextFragment(content: string, target: JsExpression, targetType: TargetType, elementContext: ElementContextType) {
		content = trim(content);
		if (content) {
			var parseResult = parser.parse(content);
			processParsedResult(parseResult, target, targetType, elementContext, false);
		}
	}
	//MUST RETURN Renderer::Expression
	function makePutValue(expression: ExpressionToken, inFunctionCall: boolean): any {
		var exp: JsExpression,
			cnt: number,
			arr: string[];
		if (expression.contentType === 'identifier'){
			if (expression.content && expression.content.content) {
				return makePutValue(expression.content, false);
			}
			else {
				arr = expression.content.split('.');
				if (inFunctionCall) {
					exp = renderer.expression('x');
					for (cnt = 0; cnt < arr.length - 1; cnt += 1){
						exp = exp.element(renderer.literal(arr[cnt]));
					}
					if (arr.length > 1) {
						exp = renderer.newAssignment('y', exp).member(arr[arr.length-1]);
					}
				}
				else {
					exp = renderer.expression('context');
					for (cnt = 0; cnt < arr.length; cnt += 1){
						exp = exp.element(renderer.literal(arr[cnt]));
					}
				}
				return exp;
			}
		}
		else if (expression.contentType === 'functionCall'){
			return solveFunctionCall(expression, inFunctionCall);
		}
		else if (expression.contentType === 'string'){
			return renderer.literal(safeFilter(expression.content));
		}
		else {
			throw new Error('unsupported content type ' + expression.contentType);
		}
	}
	var optimizerSortMap: { [name: string]: number } = { '9js': 1, 'Dijit': 2, 'DOM': 3, 'String' : 4};
	function optimizerSort(a: string, b: string) {
		return (optimizerSortMap[a] || 4) - (optimizerSortMap[b] || 4);
	}
	function processExpression(expression: ExpressionToken, target: JsExpression, targetType: TargetType, elementContext: ElementContextType, compound: boolean) {
		var optimized = expression.optimized || ['String', 'DOM', '9js', 'Dijit'];
		function putValue(targetType: TargetType) {
			var cnt: number,
				condition: Condition;
			function testPut(opType: string) {
				if (opType === 'String') {
					return renderer.expression('putValue').notEquals(renderer.raw('undefined')).parenthesis();
				}
				else if (opType === 'DOM') {
					return renderer.expression('putValue').member('tagName');
				}
				else if (opType === 'Dijit') {
					return renderer.expression('putValue').member('domNode');
				}
				else if (opType === '9js') {
					return renderer.expression('putValue').element(renderer.literal('$njsWidget'));
				}
			}
			function processPut(opType: string) {
				if (opType === 'String') {
					renderer
						.addAssignment(
							target,
							renderer
								.expression(target)
								.plus(
									renderer
										.expression('putValue')
										.notEquals(renderer.raw('undefined'))
										.iif(renderer.expression('putValue'), renderer.literal(''))
										.parenthesis()
								)
						);
				}
				else if (opType === 'DOM') {
					renderer.addStatement(renderer.expression('node').member('appendChild').invoke(renderer.expression('putValue')));
					renderer
						.addAssignment(
							'txn',
							renderer
								.expression('t')
								.invoke(
									renderer.expression('node'),
									renderer.literal(''),
									renderer
										.expression('node')
										.member('ownerDocument')
								)
							);
//							r += 'node.appendChild(putValue);\ntxn = t(node, \'\', node.ownerDocument);\n';
				}
				else if (opType === '9js') {
					renderer
						.addStatement(
							renderer
								.expression('putValue')
								.member('show')
								.invoke(renderer.expression('node'))
						);
//							r += 'putValue.show(node);\n';
				}
				else if (opType === 'Dijit') {
					renderer
						.addStatement(
							renderer
								.expression('node')
								.member('appendChild')
								.invoke(renderer.expression('putValue').member('domNode'))
						);
//							r += 'node.appendChild(putValue.domNode);\n';
				}
			}
			if (targetType === TargetType.Attr){
				var attrCondition: Condition,
					attrElse: Renderer;
				if (compound) {
					attrCondition = renderer.addCondition(renderer.expression(target).notEquals(renderer.literal('')));
					attrCondition.renderer.addAssignment(target, renderer.expression(target).op('+', renderer.expression('putValue').or(renderer.literal('')).parenthesis() ));
					attrElse = attrCondition.elseDo();
					attrElse.addAssignment(target, renderer.expression('putValue').or(renderer.literal('')).parenthesis());
				}
				else {
					var attrCondition = renderer.addCondition(renderer.expression('putValue').notEquals(renderer.raw('undefined')));
					attrCondition.renderer.addAssignment(target, renderer.expression('putValue'));
					var attrElse = attrCondition.elseDo();
					attrElse.addAssignment(target, renderer.literal(''));
				}
//						r += target + ' += putValue || "";\n';
			}
			else if (targetType === TargetType.Text){
				if (optimized.length > 1) {
					elementContext.needsDom = true;
					renderer = pushRenderer(
						renderer.addCondition(
							renderer.expression('putValue')
								.notEquals(
									renderer.raw('undefined')
								)
								.parenthesis()
								.and(
									renderer
										.expression('putValue')
										.notEquals(
											renderer.raw('null')
										)
										.parenthesis()
								)
						)
						.renderer);
					//r += 'if (putValue) {\n';
					optimized = optimized.sort(optimizerSort);
					for (cnt = 0; cnt < optimized.length; cnt += 1) {
						if (cnt === 0) {
							condition = renderer.addCondition(testPut(optimized[cnt]));
							renderer = pushRenderer(condition.renderer);
						}
						else {
							renderer = condition.elseIf(testPut(optimized[cnt]));
						}
						processPut(optimized[cnt]);
						if ((cnt + 1) === optimized.length) {
							renderer = popRenderer();// renderer.getParentRenderer(); //out of inner if
						}
					}
					renderer = popRenderer();// renderer.getParentRenderer(); //out of if(putValue)
					//r += '}\n';
				}
				else {
					if (optimized[0] !== 'String') {//Only String optimizers are elegible for an innerHTML solution
						elementContext.needsDom = true;
					}
					processPut(optimized[0]);
				}
			}
		}
		var r = '';
		if ((expression.contentType === 'identifier') || (expression.contentType === 'functionCall')){
			renderer.addAssignment('putValue', makePutValue(expression, false));
			putValue(targetType);
		}
		else {
			console.log('unsupported expression content type: ');
			console.log(expression);
		}
		return r;
	}
	/**
	If the parser finds a live expression then it attempts to rewrite the whole element or attribute on change
	*/
	function processLiveExpression(expression: ExpressionToken, target: JsExpression, targetType: TargetType, elementContext: ElementContextType, compound: boolean) {
		/* jshint unused: true */
		elementContext.needsRerenderer = true;
		elementContext.needsDom = true;
		if (!elementContext.reRenderTargets) {
			elementContext.reRenderTargets = [];
		}
		if (expression.contentType === 'identifier') {
			elementContext.reRenderTargets.push((expression.content || '').split('.'));
		}
		return processExpression.apply(null, arguments);
	}

	/**
	Tells whether a given class attribute is representing an attach point
	@param {Object|Array|Function|String} obj - the object to be represented
	*/
	function isAttachPoint(xmlNode: XmlNode) {
		return (/^data-(ninejs-attach|dojo-attach-point)$/).test(xmlNode.nodeName());
	}
	function processAttachPoint(xmlNode: XmlNode) {
		var condition: Condition,
			conditionRenderer: Renderer,
			innerCondition: Condition,
			innerElse: Renderer,
			elseRenderer: Renderer;
		renderer
			.addAssignment(
				'attachTemp',
				renderer
					.expression('r')
					.element(renderer.literal(xmlNode.value()))
			);
		condition = renderer.addCondition(renderer.expression('attachTemp'));
		conditionRenderer = condition.renderer;
		innerCondition = conditionRenderer
			.addCondition(
				conditionRenderer
					.expression('Object')
					.member('prototype')
					.member('toString')
					.member('call')
					.invoke(conditionRenderer.expression('attachTemp'))
					.equals(
						conditionRenderer.literal('[object Array]')
					)
			);
		innerCondition
			.renderer
			.addStatement(
				innerCondition.renderer
					.expression('attachTemp')
					.member('push')
					.invoke(
						innerCondition.renderer.expression('node')
					)
			);
		innerElse = innerCondition.elseDo();
		innerElse
			.addAssignment(
				innerElse
					.expression('r')
					.element(innerElse.literal(xmlNode.value())),
				innerElse
					.array([])
						.add(innerElse.expression('attachTemp'))
						.add(innerElse.expression('node'))
			);
		elseRenderer = condition.elseDo();
		elseRenderer
			.addAssignment(
				elseRenderer
					.expression('r')
					.element(elseRenderer.literal(xmlNode.value())),
				elseRenderer
					.expression('node')
			);
		//return 'attachTemp = r[\'' + xmlNode.value() + '\'];\nif (attachTemp) {\nif ( Object.prototype.toString.call( attachTemp ) === \'[object Array]\' ) {\nattachTemp.push(node);\n}\nelse {\nr[\'' + xmlNode.value() + '\'] = [attachTemp, node];\n}\n}\nelse {\nr[\'' + xmlNode.value() + '\'] = node;\n}\n';
	}
	function isOnEvent(xmlNode: XmlNode) {
		return (/^data-ninejs-on-/).test(xmlNode.nodeName());
	}
	function processOnEvent(xmlNode: XmlNode) {
		var eventName = xmlNode.nodeName().substr('data-ninejs-on-'.length),
			methodName = xmlNode.value(),
			eventRenderer = renderer.newFunction([]);
		eventRenderer.addStatement(
			eventRenderer
				.expression('context')
				.member(methodName)
				.member('apply')
				.invoke(
					eventRenderer.expression('context'),
					eventRenderer.expression('arguments')
				)
		);
		renderer.addStatement(
			renderer
				.expression('node')
				.member('addEventListener')
				.invoke(renderer.literal(eventName), eventRenderer)
		);
	}
	function isSubscribeEvent(xmlNode: XmlNode) {
		return (/^data-ninejs-subscribe-/).test(xmlNode.nodeName());
	}
	function processSubscribeEvent(xmlNode: XmlNode) {
		var eventName = xmlNode.nodeName().substr('data-ninejs-subscribe-'.length),
			methodName = xmlNode.value(),
			eventRenderer = renderer.newFunction([]),
			subsFunction = renderer.newFunction([]),
			subsFunctionName = renderer.getNewVariable();
		subsFunction.addParameter('node');
		eventRenderer.addReturn(
			eventRenderer
				.expression('context')
				.element(eventRenderer.literal(methodName))
				.invoke(
				eventRenderer.expression('node'),
				eventRenderer.expression('context')
			)
		);
		subsFunction.addStatement(
			renderer
				.expression('context')
				.member('subscribe')
				.invoke(subsFunction.literal(eventName), eventRenderer)
		);
		renderer.addVar(subsFunctionName, subsFunction);
		renderer.addStatement(
			renderer.expression(subsFunctionName).invoke(renderer.expression('node'))
		);

	}
	function isAmdPlugin(xmlNode: XmlNode) {
		return ((xmlNode.namespaceUri() || '').indexOf('amd://') === 0) && (xmlNode.nodeName().indexOf('__') < 0);
	}
	function processAmdPlugin(xmlNode: XmlNode) {
		var namespaceUri = xmlNode.namespaceUri(),
			amdPrefix = namespaceUri.substr(6),
			moduleName = xmlNode.nodeName(),
			mid = amdPrefix + '/' + moduleName,
			amdModuleVar = amdPathMapping[mid];
		enableAmd();
		if (!amdModuleVar) {
			amdModuleVar = renderer.getNewVariable();//Here I'm asking renderer and not parentRenderer to avoid a shadowing
			amdPathMapping[mid] = amdModuleVar;
			parentRenderer
				.addVar(
					amdModuleVar,
					parentRenderer
						.expression('require')
						.invoke(
							parentRenderer.literal(mid)
						)
					);
		}

		var options: { [name: string]: string } = {};
		//searching for options
		xmlNode.parentNode().getAttributes().filter(function (at) {
			return at.namespaceUri() === namespaceUri && (at.nodeName().indexOf((moduleName + '__')) === 0);
		}).forEach(function (at) {
			options[at.nodeName().substr((moduleName + '__').length)] = at.value();
			at.set('skip', true);
		});

		renderer.addStatement(
			renderer
			.expression(amdModuleVar)
			.invoke(
				renderer.expression('node'),
				renderer.expression('context'),
				renderer.literal(xmlNode.value()),
				renderer.raw(JSON.stringify(options))
			)
		);
	}
	function processExpressionToken(result: ExpressionToken, target: JsExpression, targetType: TargetType, elementContext: ElementContextType, compound: boolean) {
		if (result.modifier === 'live') {
			if (result.value.type === 'expression'){
				processLiveExpression(<ExpressionToken> result.value, target, targetType, elementContext, compound);
			}
			else {
				console.log('unsupported expression token type: ');
				console.log(result.value);
			}
		}
		else {
			if (result.value.type === 'expression'){
				processExpression(result.value, target, targetType, elementContext, compound);
			}
			else {
				console.log('unsupported expression token type: ');
				console.log(result.value);
			}
		}
	}
	function getAppendStrategy(xmlNode: XmlNode) {
		if (xmlNode.namespaceUri() === svgNamespace) {
			return 'aens';
		}
		else {
			return 'ens';
		}
	}
	//MUST return Renderer::Expression
	function solveFunctionCall(expression: ExpressionToken, inFunctionCall: boolean){
		var arr: ExpressionToken[] = expression['arguments'];
		var cnt: number;
		var functionArgs: any[] = [];
		for (cnt = 0; cnt < arr.length; cnt += 1){
			functionArgs.push(makePutValue(arr[cnt], inFunctionCall));
		}
		if (inFunctionCall) {
			renderer.addAssignment('x', makePutValue(expression.content, true));
			renderer
				.addAssignment(
					'x',
					renderer
						.expression('x')
						.member('apply')
						.invoke(
							renderer.expression('y'),
							renderer.array(functionArgs)
						)
				);
			return renderer.expression('x');
//					r += 'y = x;\nx = x.apply(y, [' + functionArgs.join(', ') + ']);\n';
		}
		else {
			if (expression.content && expression.content.contentType !== 'functionCall') {
				return renderer
					.newAssignment(
						'x',
						makePutValue(expression.content, false)
							.member('apply')
							.invoke(renderer.expression('context'), renderer.array(functionArgs))
						);
			}
			else {
				return renderer
					.newAssignment(
						'x',
						makePutValue(expression.content, false)
							.member('apply')
							.invoke(renderer.expression('x'), renderer.array(functionArgs))
						);
			}
		}
	}
	function solveTagName(xmlNode: XmlNode, isRoot: boolean, elementContext: ElementContextType) {
		if (xmlNode.hasVariableTagName()) {
			xmlNode.getVariableTagName(function(val) {
				processTextFragment(val, renderer.expression('x'), TargetType.Attr, elementContext);
			});
			if (isRoot) {
				renderer
					.addAssignment(
						'node',
						renderer
							.expression('document')
							.member('createElement')
							.invoke(
								renderer.expression('putValue').or(renderer.literal(xmlNode.nodeName()))
							)
					);
//						r += 'node = document.createElement(putValue || \'' + xmlNode.nodeName() + '\');\n';
			}
			else {
				renderer
					.addAssignment(
						'node',
						renderer
							.expression('e')
							.invoke(
								renderer.expression('node'),
								renderer.expression('putValue').or(renderer.literal(xmlNode.nodeName())),
								renderer.expression('node').member('ownerDocument')
							)
					);
//						r += 'node = e(node, putValue || \'' + xmlNode.nodeName() + '\', node.ownerDocument);\n';
			}
		}
		else {
			if (isRoot) {
				if (xmlNode.namespaceUri()) {
					renderer
						.addAssignment(
						'node',
						renderer
							.expression('document')
							.member('createElementNS')
							.invoke(
							renderer.literal(xmlNode.namespaceUri()),
							renderer.literal(xmlNode.nodeName())
						)
					);
				}
				else {
					renderer
						.addAssignment(
						'node',
						renderer
							.expression('document')
							.member('createElement')
							.invoke(
							renderer.literal(xmlNode.nodeName())
						)
					);
				}
//						r += 'node = document.createElement(\'' + xmlNode.nodeName() + '\');\n';
			}
			else {
				if (xmlNode.namespaceUri()) {
					renderer
						.addAssignment(
						'node',
						renderer
							.expression(getAppendStrategy(xmlNode))
							.invoke(
							renderer.expression('node'),
							renderer.literal(xmlNode.nodeName()),
							renderer.literal(xmlNode.namespaceUri()),
							renderer.expression('node').member('ownerDocument')
						)
					);
				}
				else {
					renderer
						.addAssignment(
						'node',
						renderer
							.expression('e')
							.invoke(
							renderer.expression('node'),
							renderer.literal(xmlNode.nodeName()),
							renderer.expression('node').member('ownerDocument')
						)
					);
				}
			}
		}
	}
	function processAttribute(xmlNode: XmlNode, attName: string, elementContext: ElementContextType) {
		var attval: string;
		if (isAttachPoint(xmlNode) || attName === 'data-ninejs-tagName') {
			elementContext.needsDom = true;
			processAttachPoint(xmlNode);
		} else if (isOnEvent(xmlNode)) {
			elementContext.needsDom = true;
			processOnEvent(xmlNode);
		} else if (isAmdPlugin(xmlNode)) {
			elementContext.needsDom = true;
			processAmdPlugin(xmlNode);
		} else if (isSubscribeEvent(xmlNode)) {
			elementContext.needsDom = true;
			processSubscribeEvent(xmlNode);
		} else {
			renderer.addAssignment('av', renderer.literal(''));
//					r += 'av = \'\';\n';
			attval = xmlNode.value();
			processTextFragment(attval, renderer.expression('av'), TargetType.Attr, elementContext);
			if (elementContext.mode === 'amdExtension') {
				renderer
					.addStatement(
						renderer
							.expression('node')
							.member('set')
							.invoke(
								renderer.literal(attName),
								renderer.expression('av')
							)
					);
			}
			else {
				if ((attName === 'class') && (!xmlNode.parentNode() || !xmlNode.parentNode().namespaceUri())) {
					renderer
						.addAssignment(
							renderer.expression('node').member('className'),
							renderer.expression('av')
						);
//						r += 'node.className = av;\n';
				}
				else {
					if (!isAmdExtensionValue(attval)) {
						renderer
							.addStatement(
							renderer
								.expression('node')
								.member('setAttribute')
								.invoke(
								renderer.literal(attName),
								renderer.expression('av')
							)
						);
					}
				}
			}
		}
//				return r;
	}
	function assignDependencies(fn: ResultFunction) {
		var p: string,
			r: string[] = [];
		for (p in amdPathMapping) {
			if (amdPathMapping.hasOwnProperty(p)) {
				r.push(p);
			}
		}
		fn.amdDependencies = r;
	}
	var result: ResultFunction,
		promise: any;
	//Do some processing
	renderer
		.addParameter('context')
		.addParameter('document')
		.init();
	if (options.standaloneTemplate) {
		renderer
			.addVar('fn', objUtils.deepToString(functions));
	}
	else {
		enableAmd();
		parentRenderer
			.addVar('fn', parentRenderer
				.expression('require')
				.invoke(parentRenderer.literal(`${options.ninejsPrefix || 'ninejs'}/_nineplate/utils/functions`)));
		amdPathMapping[`${options.ninejsPrefix || 'ninejs'}/_nineplate/utils/functions`] = 'fn';
	}
	renderer
		.addVar('r', renderer.raw('{}'));

	if (sync) {
		//buildString += processDom();
		processDom();
		renderer.addReturn(renderer.varName('r'));
		result = <ResultFunction> renderer.getFunction();
		assignDependencies(result);
	}
	else {
		promise = processDom();
		return def.when(promise, function(/*value*/) {
			var result: ResultFunction;
			//buildString += value;
			renderer.addReturn('r');
			result = <ResultFunction> renderer.getFunction();
			assignDependencies(result);
			return result;
		}, function (error) {
			throw error;
		});
	}
	renderer = popRenderer();
	if (renderer) {
		throw new Error('syntax error. May be an unclosed control structure.');
	}
	return result;
}