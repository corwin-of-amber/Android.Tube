const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');

const outdir = 'research/nsig';
const searchString = 'enhanced_except_';
const WORKING_REGEX = /index\.m3u8".*=(.*?)[.]set\(/;


class JSPlayerCode {

    constructor(filePath) {
        this.code = fs.readFileSync(filePath, 'utf8');
        this.ast = acorn.parse(this.code, { ecmaVersion: 2020, sourceType: 'module' });
    }

    getCode(node) {
        return this.code.substring(node.start, node.end);
    }

    findFuncContainingLiteral(searchString) {
        let closestFunctionNode = null;
        let foundLiteralNode = null;


        function handleNode(node, ancestors) {
            foundLiteralNode = node;
            const containingFunction = ancestors.reverse().find(ancestor => 
                ['FunctionExpression', 'FunctionDeclaration', 'ArrowFunctionExpression'].includes(ancestor.type)
            );

            if (containingFunction) {
                closestFunctionNode = containingFunction;
            }
        }

        // Traverse the AST to find the string literal and its closest containing function
        walk.ancestor(this.ast, {
            Literal(node, ancestors) {
                if (typeof node.value === 'string' && node.value.startsWith(searchString)) {
                    handleNode(node, ancestors);
                }
            }
        });

        return {literal: foundLiteralNode, func: closestFunctionNode};
    }
}


function parseArgs() {
    const commander = require('commander');

    let prog = new commander.Command()
        .arguments("<filename...>")
        .option("--testrun", "just try the currently hard-coded regex")
        .action(function(fn) { this.filenames = fn });

    return prog.parse(process.argv);
}

function main() {
    let o = parseArgs();

    if (o.testrun) {
        for (let fn of o.filenames) {
            let body = fs.readFileSync(fn, 'utf-8');
            console.log(fn, body.match(WORKING_REGEX)?.[1]);
        }
        return;
    }

    for (let fn of o.filenames) {
        const jsp = new JSPlayerCode(fn);

        let {literal, func} = jsp.findFuncContainingLiteral(searchString);

        if (literal && func) {
            console.log('Found string literal node:', literal);
            console.log('Closest containing function node:', func);
            const fcode = jsp.getCode(func),
                  outfn = path.join(outdir, path.basename(fn));
            fs.mkdirSync(outdir, {recursive: true});
            console.log(`> ${outfn}`);
            fs.writeFileSync(outfn, fcode);
        } else {
            console.log(`${fn}: String literal or containing function not found.`);
        }
    }
}


main();
