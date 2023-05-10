"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const github = __importStar(require("@actions/github"));
const fs = __importStar(require("fs/promises"));
const toml = __importStar(require("toml"));
function createRelease(tagName, targetCommitish, name, body) {
    return __awaiter(this, void 0, void 0, function* () {
        const octokit = github.getOctokit(core.getInput('github-token', { required: true }));
        const createReleaseResponse = yield octokit.rest.repos.createRelease({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            tag_name: tagName,
            target_commitish: targetCommitish,
            name: name,
            body: body,
            draft: true,
            prerelease: false,
        });
        return createReleaseResponse.data.upload_url;
    });
}
function uploadAsset(uploadUrl, assetPath, assetName) {
    return __awaiter(this, void 0, void 0, function* () {
        const octokit = github.getOctokit(core.getInput('github-token', { required: true }));
        const headers = {
            'content-type': 'application/octet-stream',
            'content-length': String(require('fs').statSync(assetPath).size),
        };
        const uploadAssetResponse = yield octokit.request({
            method: 'POST',
            url: uploadUrl,
            headers,
            data: require('fs').readFileSync(assetPath),
        });
        if (uploadAssetResponse.status !== 201) {
            throw new Error(`Failed to upload asset: ${uploadAssetResponse.status} - ${uploadAssetResponse.data}`);
        }
        core.info(`Uploaded asset ${assetName}`);
    });
}
function getTarget() {
    const target = core.getInput('target');
    if (target !== '')
        return target;
    const os = process.platform;
    if (os.includes('linux')) {
        return 'x86_64-unknown-linux-gnu';
    }
    else if (os.includes('win32')) {
        return 'x86_64-pc-windows-msvc';
    }
    else if (os.includes('darwin')) {
        return 'x86_64-apple-darwin';
    }
    else {
        core.setFailed(`Unsupported operating system: ${os}`);
        process.exit();
    }
}
function getVersionFromToml() {
    return __awaiter(this, void 0, void 0, function* () {
        const cargoTomlPath = core.getInput('cargo-toml-path');
        console.info(yield fs.readdir('./'));
        console.info(yield fs.readdir('../'));
        try {
            const cargoTomlContents = yield fs.readFile(cargoTomlPath !== '' ? cargoTomlPath : 'cargo.toml', { encoding: 'utf8' });
            const cargoToml = toml.parse(cargoTomlContents);
            return `v${cargoToml.package.version}`;
        }
        catch (error) {
            if (error instanceof Error)
                core.setFailed(error.message);
            process.exit();
        }
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const target = getTarget();
            yield exec.exec('cargo', ['build', '--release', '--target', target]);
            const assetPath = `target/${target}/release/my_rust_binary`;
            const assetName = 'my_rust_binary';
            const publishRelease = core.getInput('publish-release') === 'true';
            if (!publishRelease) {
                core.setOutput('output', 'Successfully compiled Rust code.');
                process.exit();
            }
            const releaseName = yield getVersionFromToml();
            const uploadUrl = yield createRelease(releaseName, github.context.sha, releaseName, 'Description of the release.');
            yield uploadAsset(uploadUrl, assetPath, assetName);
            core.setOutput('output', 'Successfully compiled and drafted your Rust code.');
        }
        catch (error) {
            if (error instanceof Error)
                core.setFailed(error.message);
        }
    });
}
run();
